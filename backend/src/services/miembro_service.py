import json
import re

from sqlalchemy.orm import Session

from src.db.models.miembro_model import Miembro
from src.db.models.servidor_model import Servidor
from src.dtos.miembro_dto import MiembroResponseDTO, MiMembresiaDTO
from src.mappers.miembro_mapper import to_miembro_response
from src.repositories.historial_repository import HistorialRepository
from src.repositories.miembro_repository import MiembroRepository
from src.repositories.perfil_repository import PerfilRepository
from src.repositories.rol_repository import RolRepository
from src.repositories.usuario_repository import UsuarioRepository
from src.services.permisos_service import PermisosService
from src.utils.errors import ConflictError, ForbiddenError, NotFoundError, UnprocessableError


class MiembroService:
    """Consultas y acciones sobre los miembros de un servidor (HU9, HU10)."""

    def __init__(self, db: Session):
        self.db = db
        self.miembros = MiembroRepository(db)
        self.roles = RolRepository(db)
        self.permisos = PermisosService(db)
        self.historial = HistorialRepository(db)

    # ---------- Lista de miembros ----------
    def list_by_servidor(self, servidor_id: int, actual_id: int) -> list[MiembroResponseDTO]:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_miembro(servidor.id, actual_id)

        avatares = self.miembros.avatares(servidor.id)
        resultado = []
        for miembro, usuario in self.miembros.list_activos(servidor.id):
            roles = self.roles.roles_de_usuario(servidor.id, usuario.id)
            dto = to_miembro_response(miembro, usuario, roles, es_duenio=servidor.duenio_id == usuario.id)
            # Si eligió una foto especial para este servidor, se muestra esa.
            dto.avatar_url = avatares.get(usuario.id, dto.avatar_url)
            resultado.append(dto)
        return resultado

    # ---------- HU9: expulsar (kick) ----------
    def expulsar(self, servidor_id: int, usuario_id: int, actual_id: int) -> None:
        """Quita al usuario del servidor. Puede volver con otra invitación válida."""
        servidor, miembro = self._validar_moderacion(servidor_id, usuario_id, actual_id, "expulsar")

        self.roles.quitar_todos_en_servidor(usuario_id, servidor.id)
        self.miembros.delete(miembro)
        self.historial.cerrar(usuario_id, servidor.id, "expulsado")
        self.db.commit()

    # ---------- HU9: banear ----------
    def banear(self, servidor_id: int, usuario_id: int, actual_id: int) -> None:
        """Marca baneado = true (la fila queda, para impedir que vuelva) y le
        quita sus roles en el servidor."""
        servidor, miembro = self._validar_moderacion(servidor_id, usuario_id, actual_id, "banear")

        self.roles.quitar_todos_en_servidor(usuario_id, servidor.id)
        self.miembros.marcar_baneado(miembro)
        self.historial.cerrar(usuario_id, servidor.id, "baneado")
        self.db.commit()

    # ---------- HU10: salir del servidor ----------
    def salir(self, servidor_id: int, actual_id: int) -> None:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_miembro(servidor.id, actual_id)

        # El dueño no puede salir sin antes transferir el servidor a otro miembro.
        if self.permisos.es_duenio(servidor, actual_id):
            raise UnprocessableError(
                "Sos el dueño: antes de salir tenés que transferir el servidor a otro miembro"
            )

        miembro = self.miembros.find(actual_id, servidor.id)
        # Al salir se le quitan sus roles de ese servidor.
        self.roles.quitar_todos_en_servidor(actual_id, servidor.id)
        self.miembros.delete(miembro)
        self.historial.cerrar(actual_id, servidor.id, "salio")
        self.db.commit()

    # ---------- Lo que cada uno configura para sí en el servidor ----------
    def mi_membresia(self, servidor_id: int, actual_id: int) -> MiMembresiaDTO:
        miembro = self._mi_fila(servidor_id, actual_id)
        return self._membresia_dto(miembro)

    def elegir_foto(self, servidor_id: int, foto_id: int | None, actual_id: int) -> MiMembresiaDTO:
        """Qué foto de perfil uso en este servidor (None = la principal)."""
        miembro = self._mi_fila(servidor_id, actual_id)
        if foto_id is not None:
            foto = PerfilRepository(self.db).find_foto(foto_id)
            if foto is None or foto.usuario_id != actual_id:
                raise NotFoundError("Esa foto no es tuya")
        self.miembros.update(miembro, foto_id=foto_id)
        self.db.commit()
        return self._membresia_dto(miembro)

    def ordenar_secciones(self, servidor_id: int, orden: list[str], actual_id: int) -> MiMembresiaDTO:
        """Mi orden de las pestañas del servidor. Es personal: no cambia lo que ven los demás."""
        miembro = self._mi_fila(servidor_id, actual_id)
        limpio = list(dict.fromkeys(orden))  # sin repetidos
        if any(not re.fullmatch(r"[a-z]{1,20}(:[0-9]{1,9})?", clave) for clave in limpio):
            raise UnprocessableError("Orden inválido")
        self.miembros.update(miembro, orden_secciones=json.dumps(limpio) if limpio else None)
        self.db.commit()
        return self._membresia_dto(miembro)

    def _mi_fila(self, servidor_id: int, actual_id: int) -> Miembro:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_miembro(servidor.id, actual_id)
        return self.miembros.find(actual_id, servidor.id)

    @staticmethod
    def _membresia_dto(miembro: Miembro) -> MiMembresiaDTO:
        return MiMembresiaDTO(
            apodo=miembro.apodo,
            foto_id=miembro.foto_id,
            orden_secciones=json.loads(miembro.orden_secciones) if miembro.orden_secciones else None,
        )

    # ---------- Apodos ----------
    def cambiar_apodo(self, servidor_id: int, usuario_id: int, apodo: str | None, actual_id: int) -> MiembroResponseDTO:
        """Cada uno cambia su propio apodo. Un moderador puede cambiar el de
        otros, pero el del dueño solo lo cambia el dueño."""
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_miembro(servidor.id, actual_id)
        if usuario_id != actual_id:
            self.permisos.exigir_moderador(servidor, actual_id)
            if self.permisos.es_duenio(servidor, usuario_id):
                raise ForbiddenError("Solo el dueño puede cambiar su propio apodo")

        miembro = self.miembros.find(usuario_id, servidor.id)
        if miembro is None or miembro.baneado:
            raise NotFoundError("Ese usuario no es miembro de este servidor")

        apodo = " ".join((apodo or "").split()) or None
        if apodo is not None and len(apodo) > 32:
            raise UnprocessableError("El apodo puede tener hasta 32 caracteres")
        self.miembros.update(miembro, apodo=apodo)
        self.db.commit()

        usuario = UsuarioRepository(self.db).find_by_id(usuario_id)
        roles = self.roles.roles_de_usuario(servidor.id, usuario_id)
        return to_miembro_response(miembro, usuario, roles, es_duenio=servidor.duenio_id == usuario_id)

    # ---------- Ayudas internas ----------
    def _validar_moderacion(
        self, servidor_id: int, usuario_id: int, actual_id: int, accion: str
    ) -> tuple[Servidor, Miembro]:
        """Reglas comunes a expulsar y banear."""
        servidor = self.permisos.obtener_servidor(servidor_id)
        # Solo moderadores (o el dueño).
        self.permisos.exigir_moderador(servidor, actual_id)

        # Nadie puede expulsar ni banear al dueño.
        if self.permisos.es_duenio(servidor, usuario_id):
            raise ForbiddenError(f"No se puede {accion} al dueño del servidor")
        if usuario_id == actual_id:
            raise UnprocessableError(f"No te podés {accion} a vos mismo. Para irte, usá 'salir'")

        miembro = self.miembros.find(usuario_id, servidor.id)
        if miembro is None:
            raise NotFoundError("Ese usuario no es miembro de este servidor")
        if miembro.baneado:
            raise ConflictError("Ese usuario ya está baneado de este servidor")
        return servidor, miembro
