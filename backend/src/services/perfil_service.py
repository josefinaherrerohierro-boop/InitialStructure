from sqlalchemy.orm import Session

from src.db.models.perfil_model import REDES_PERMITIDAS
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
            fotos=[FotoPerfilDTO.model_validate(f) for f in self.perfiles.fotos(usuario.id)],
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

    # ---------- Historial de servidores en los que estuve ----------
    def historial_servidores(self, actual_id: int) -> list[HistorialServidorDTO]:
        return [
            HistorialServidorDTO(
                id=h.id,
                servidor_id=h.servidor_id,
                servidor_nombre=servidor.nombre if servidor else h.servidor_nombre,
                fecha_union=h.fecha_union,
                fecha_salida=h.fecha_salida,
                motivo_salida=h.motivo_salida,
                sigue_existiendo=servidor is not None,
            )
            for h, servidor in self.historial.list_de_usuario(actual_id)
        ]

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
