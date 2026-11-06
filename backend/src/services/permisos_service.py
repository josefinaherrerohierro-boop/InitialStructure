from sqlalchemy.orm import Session

from src.db.models.servidor_model import Servidor
from src.repositories.miembro_repository import MiembroRepository
from src.repositories.rol_repository import RolRepository
from src.repositories.servidor_repository import ServidorRepository
from src.utils.errors import ForbiddenError, NotFoundError


class PermisosService:
    """Reglas de permisos usadas por TODAS las funcionalidades.

    Centralizarlas acá evita repetir la misma lógica en cada service y
    asegura que se validen siempre en el backend, no solo en el frontend.

    - Miembro:    tiene fila en `miembros` y NO está baneado.
    - Dueño:      servidores.duenio_id == usuario.
    - Moderador:  el dueño, o un miembro con algún rol con puede_moderar.
    - Invitador:  el dueño, o un miembro con algún rol con puede_invitar.
    """

    def __init__(self, db: Session):
        self.servidores = ServidorRepository(db)
        self.miembros = MiembroRepository(db)
        self.roles = RolRepository(db)

    # ---------- Consultas (devuelven True / False) ----------
    def es_miembro(self, servidor_id: int, usuario_id: int) -> bool:
        miembro = self.miembros.find(usuario_id, servidor_id)
        return miembro is not None and not miembro.baneado

    def es_duenio(self, servidor: Servidor, usuario_id: int) -> bool:
        return servidor.duenio_id == usuario_id

    def es_moderador(self, servidor: Servidor, usuario_id: int) -> bool:
        if self.es_duenio(servidor, usuario_id):
            return True
        return self.es_miembro(servidor.id, usuario_id) and self.roles.usuario_tiene_permiso(
            servidor.id, usuario_id, "puede_moderar"
        )

    def puede_invitar(self, servidor: Servidor, usuario_id: int) -> bool:
        if self.es_duenio(servidor, usuario_id):
            return True
        return self.es_miembro(servidor.id, usuario_id) and self.roles.usuario_tiene_permiso(
            servidor.id, usuario_id, "puede_invitar"
        )

    def puede_escribir(self, servidor_id: int, usuario_id: int) -> bool:
        return self.es_miembro(servidor_id, usuario_id) and self.roles.usuario_tiene_permiso(
            servidor_id, usuario_id, "puede_escribir"
        )

    # ---------- Exigencias (lanzan error si no se cumple) ----------
    def obtener_servidor(self, servidor_id: int) -> Servidor:
        servidor = self.servidores.find_by_id(servidor_id)
        if servidor is None:
            raise NotFoundError("Servidor no encontrado")
        return servidor

    def exigir_miembro(self, servidor_id: int, usuario_id: int) -> None:
        if not self.es_miembro(servidor_id, usuario_id):
            raise ForbiddenError("No sos miembro de este servidor")

    def exigir_duenio(self, servidor: Servidor, usuario_id: int) -> None:
        if not self.es_duenio(servidor, usuario_id):
            raise ForbiddenError("Solo el dueño del servidor puede hacer esto")

    def exigir_moderador(self, servidor: Servidor, usuario_id: int) -> None:
        if not self.es_moderador(servidor, usuario_id):
            raise ForbiddenError("Solo el dueño o un moderador puede hacer esto")
