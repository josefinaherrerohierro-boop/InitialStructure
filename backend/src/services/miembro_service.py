from sqlalchemy.orm import Session

from src.db.models.miembro_model import Miembro
from src.db.models.servidor_model import Servidor
from src.dtos.miembro_dto import MiembroResponseDTO
from src.mappers.miembro_mapper import to_miembro_response
from src.repositories.miembro_repository import MiembroRepository
from src.repositories.rol_repository import RolRepository
from src.services.permisos_service import PermisosService
from src.utils.errors import ConflictError, ForbiddenError, NotFoundError, UnprocessableError


class MiembroService:
    """Consultas y acciones sobre los miembros de un servidor (HU9, HU10)."""

    def __init__(self, db: Session):
        self.db = db
        self.miembros = MiembroRepository(db)
        self.roles = RolRepository(db)
        self.permisos = PermisosService(db)

    # ---------- Lista de miembros ----------
    def list_by_servidor(self, servidor_id: int, actual_id: int) -> list[MiembroResponseDTO]:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_miembro(servidor.id, actual_id)

        resultado = []
        for miembro, usuario in self.miembros.list_activos(servidor.id):
            roles = self.roles.roles_de_usuario(servidor.id, usuario.id)
            resultado.append(
                to_miembro_response(miembro, usuario, roles, es_duenio=servidor.duenio_id == usuario.id)
            )
        return resultado

    # ---------- HU9: expulsar (kick) ----------
    def expulsar(self, servidor_id: int, usuario_id: int, actual_id: int) -> None:
        """Quita al usuario del servidor. Puede volver con otra invitación válida."""
        servidor, miembro = self._validar_moderacion(servidor_id, usuario_id, actual_id, "expulsar")

        self.roles.quitar_todos_en_servidor(usuario_id, servidor.id)
        self.miembros.delete(miembro)
        self.db.commit()

    # ---------- HU9: banear ----------
    def banear(self, servidor_id: int, usuario_id: int, actual_id: int) -> None:
        """Marca baneado = true (la fila queda, para impedir que vuelva) y le
        quita sus roles en el servidor."""
        servidor, miembro = self._validar_moderacion(servidor_id, usuario_id, actual_id, "banear")

        self.roles.quitar_todos_en_servidor(usuario_id, servidor.id)
        self.miembros.marcar_baneado(miembro)
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
        self.db.commit()

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
