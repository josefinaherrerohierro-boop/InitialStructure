import json

from sqlalchemy.orm import Session

from src.db.models.perfil_model import REDES_PERMITIDAS, VISIBILIDADES_FOTO
from src.db.models.usuario_model import Usuario
from src.dtos.perfil_dto import (
    FotoPerfilDTO,
    HistorialServidorDTO,
    PerfilDTO,
    RedSocialDTO,
    UpdatePerfilDTO,
)
from src.repositories.historial_repository import HistorialRepository
from src.repositories.miembro_repository import MiembroRepository
from src.repositories.perfil_repository import PerfilRepository
from src.repositories.usuario_repository import UsuarioRepository
from src.services.amistad_service import AmistadService
from src.services.archivo_service import ArchivoService
from src.utils.errors import ForbiddenError, NotFoundError, UnprocessableError

MAXIMO_FOTOS = 6
MAXIMO_ETIQUETAS = 10


class PerfilService:
    """Perfil público de cada usuario: bio, etiquetas, redes, fotos e historial."""

    def __init__(self, db: Session):
        self.db = db
        self.perfiles = PerfilRepository(db)
        self.usuarios = UsuarioRepository(db)
        self.miembros = MiembroRepository(db)
        self.historial = HistorialRepository(db)
        self.amistades = AmistadService(db)

    def perfil(self, usuario_id: int, actual_id: int) -> PerfilDTO:
        usuario = self._buscar_o_404(usuario_id)
        return PerfilDTO(
            id=usuario.id,
            username=usuario.username,
            bio=usuario.bio,
            avatar_url=usuario.avatar_url,
            fecha_registro=usuario.fecha_registro,
            etiquetas=self.perfiles.etiquetas(usuario.id),
            redes=[RedSocialDTO.model_validate(r) for r in self.perfiles.redes(usuario.id)],
            fotos=self._fotos_visibles(usuario.id, actual_id),
            relacion=self.amistades.relacion(actual_id, usuario.id),
            servidores_en_comun=0 if usuario.id == actual_id else self.miembros.servidores_en_comun(actual_id, usuario.id),
        )

    def actualizar(self, dto: UpdatePerfilDTO, actual_id: int) -> PerfilDTO:
        usuario = self._buscar_o_404(actual_id)

        if dto.bio is not None:
            usuario.bio = dto.bio.strip()[:190] or None

        if dto.etiquetas is not None:
            etiquetas: dict[str, str] = {}
            for e in dto.etiquetas:
                e = " ".join(e.split())  # sin espacios de más
                if not e:
                    continue
                if len(e) > 24:
                    raise UnprocessableError("Cada etiqueta puede tener hasta 24 caracteres")
                etiquetas.setdefault(e.lower(), e)
            if len(etiquetas) > MAXIMO_ETIQUETAS:
                raise UnprocessableError(f"Podés tener hasta {MAXIMO_ETIQUETAS} etiquetas")
            self.perfiles.reemplazar_etiquetas(usuario.id, list(etiquetas.values()))

        if dto.redes is not None:
            redes: dict[str, str] = {}
            for r in dto.redes:
                if r.red not in REDES_PERMITIDAS:
                    raise UnprocessableError("Red social no permitida")
                redes[r.red] = r.url.strip()
            self.perfiles.reemplazar_redes(usuario.id, list(redes.items()))

        self.db.commit()
        return self.perfil(usuario.id, actual_id)

    # ---------- Varias fotos de perfil ----------
    def agregar_foto(self, url: str, actual_id: int) -> PerfilDTO:
        usuario = self._buscar_o_404(actual_id)
        url = ArchivoService.validar_imagen(url)
        fotos = self.perfiles.fotos(usuario.id)
        if len(fotos) >= MAXIMO_FOTOS:
            raise UnprocessableError(f"Podés tener hasta {MAXIMO_FOTOS} fotos. Borrá alguna primero.")
        # La primera foto que se sube pasa a ser la principal (el avatar).
        foto = self.perfiles.agregar_foto(usuario.id, url, principal=not fotos)
        if foto.principal:
            usuario.avatar_url = foto.url
        self.db.commit()
        return self.perfil(usuario.id, actual_id)

    def elegir_principal(self, foto_id: int, actual_id: int) -> PerfilDTO:
        usuario = self._buscar_o_404(actual_id)
        foto = self._buscar_foto_propia(foto_id, actual_id)
        self.perfiles.marcar_principal(usuario.id, foto.id)
        # La principal se ve en todos lados, así que es visible para todos.
        self.perfiles.actualizar_foto(foto, visibilidad="todos")
        usuario.avatar_url = foto.url
        self.db.commit()
        return self.perfil(usuario.id, actual_id)

    def borrar_foto(self, foto_id: int, actual_id: int) -> PerfilDTO:
        usuario = self._buscar_o_404(actual_id)
        foto = self._buscar_foto_propia(foto_id, actual_id)
        era_principal = foto.principal
        self.perfiles.borrar_foto(foto)
        if era_principal:
            # La siguiente foto pasa a ser la principal (o no queda avatar).
            restantes = self.perfiles.fotos(usuario.id)
            nueva = restantes[0] if restantes else None
            self.perfiles.marcar_principal(usuario.id, nueva.id if nueva else None)
            usuario.avatar_url = nueva.url if nueva else None
        self.db.commit()
        return self.perfil(usuario.id, actual_id)

    def cambiar_visibilidad(self, foto_id: int, visibilidad: str, actual_id: int) -> PerfilDTO:
        """Quién ve esta foto en tu perfil: 'todos', 'amigos' u 'oculta'."""
        foto = self._buscar_foto_propia(foto_id, actual_id)
        if visibilidad not in VISIBILIDADES_FOTO:
            raise UnprocessableError("Visibilidad inválida")
        if foto.principal and visibilidad != "todos":
            raise UnprocessableError(
                "La foto principal la ve todo el mundo. Elegí otra como principal para poder ocultar esta."
            )
        self.perfiles.actualizar_foto(foto, visibilidad=visibilidad)
        self.db.commit()
        return self.perfil(actual_id, actual_id)

    def _fotos_visibles(self, duenio_id: int, actual_id: int) -> list[FotoPerfilDTO]:
        fotos = self.perfiles.fotos(duenio_id)
        if duenio_id == actual_id:
            return [FotoPerfilDTO(id=f.id, url=f.url, principal=f.principal, visibilidad=f.visibilidad) for f in fotos]
        es_amigo = self.amistades.son_amigos(duenio_id, actual_id)
        # Las que usa en servidores que compartimos ya las veo en el chat.
        compartidas = self.miembros.fotos_vistas_por(duenio_id, actual_id)
        return [
            FotoPerfilDTO(id=f.id, url=f.url, principal=f.principal)
            for f in fotos
            if f.principal
            or f.visibilidad == "todos"
            or (f.visibilidad == "amigos" and es_amigo)
            or f.id in compartidas
        ]

    # ---------- Historial de servidores en los que estuve ----------
    def historial_servidores(self, actual_id: int) -> list[HistorialServidorDTO]:
        resultado = []
        for h, servidor in self.historial.list_de_usuario(actual_id):
            sigue = h.fecha_salida is None and servidor is not None
            if sigue:
                # Sigue en el servidor: sus roles se calculan en el momento.
                roles = self.historial.roles_actuales(actual_id, servidor)
            else:
                # Ya no está: se muestran los roles que tenía al salir (si se guardaron).
                try:
                    roles = json.loads(h.roles) if h.roles else []
                except ValueError:
                    roles = []
            resultado.append(
                HistorialServidorDTO(
                    id=h.id,
                    servidor_id=h.servidor_id,
                    servidor_nombre=servidor.nombre if servidor else h.servidor_nombre,
                    fecha_union=h.fecha_union,
                    fecha_salida=h.fecha_salida,
                    motivo_salida=h.motivo_salida,
                    sigue_existiendo=servidor is not None,
                    sigue_siendo_miembro=sigue,
                    roles=[r for r in roles if isinstance(r, str)],
                )
            )
        return resultado

    # ---------- Ayudas internas ----------
    def _buscar_o_404(self, usuario_id: int) -> Usuario:
        usuario = self.usuarios.find_by_id(usuario_id)
        if usuario is None:
            raise NotFoundError("Usuario no encontrado")
        return usuario

    def _buscar_foto_propia(self, foto_id: int, actual_id: int):
        foto = self.perfiles.find_foto(foto_id)
        if foto is None:
            raise NotFoundError("Foto no encontrada")
        if foto.usuario_id != actual_id:
            raise ForbiddenError("Esa foto no es tuya")
        return foto
