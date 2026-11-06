import secrets
import string

from sqlalchemy.orm import Session

from src.db.models.invitacion_model import Invitacion
from src.dtos.invitacion_dto import CreateInvitacionDTO, InvitacionResponseDTO
from src.dtos.servidor_dto import ServidorResponseDTO
from src.mappers.invitacion_mapper import to_invitacion_response
from src.mappers.servidor_mapper import to_servidor_response
from src.repositories.invitacion_repository import InvitacionRepository
from src.repositories.miembro_repository import MiembroRepository
from src.repositories.rol_repository import RolRepository
from src.services.permisos_service import PermisosService
from src.utils.errors import ConflictError, ForbiddenError, NotFoundError, UnprocessableError
from src.utils.fechas import a_hora_local, ahora

LARGO_CODIGO = 8
CARACTERES_CODIGO = string.ascii_uppercase + string.digits  # A-Z y 0-9


class InvitacionService:
    """Reglas de negocio de las invitaciones (HU5, HU6)."""

    def __init__(self, db: Session):
        self.db = db
        self.invitaciones = InvitacionRepository(db)
        self.miembros = MiembroRepository(db)
        self.roles = RolRepository(db)
        self.permisos = PermisosService(db)

    # ---------- HU5: crear invitación ----------
    def create(self, servidor_id: int, dto: CreateInvitacionDTO, actual_id: int) -> InvitacionResponseDTO:
        servidor = self.permisos.obtener_servidor(servidor_id)
        # Solo el dueño o un miembro con un rol con puede_invitar = true.
        if not self.permisos.puede_invitar(servidor, actual_id):
            raise ForbiddenError("No tenés permiso para crear invitaciones en este servidor")

        vencimiento = a_hora_local(dto.fecha_vencimiento)
        if vencimiento <= ahora():
            raise UnprocessableError("La fecha de vencimiento tiene que ser futura")

        invitacion = self.invitaciones.create(
            servidor_id=servidor.id,
            creador_id=actual_id,
            codigo=self._generar_codigo_unico(),
            usos_maximos=dto.usos_maximos,
            fecha_vencimiento=vencimiento,
        )
        self.db.commit()
        return to_invitacion_response(invitacion)

    # ---------- Listar invitaciones del servidor ----------
    def list_by_servidor(self, servidor_id: int, actual_id: int) -> list[InvitacionResponseDTO]:
        servidor = self.permisos.obtener_servidor(servidor_id)
        if not self.permisos.puede_invitar(servidor, actual_id):
            raise ForbiddenError("No tenés permiso para ver las invitaciones de este servidor")
        return [to_invitacion_response(i) for i in self.invitaciones.list_by_servidor(servidor.id)]

    # ---------- Borrar invitación (creador, dueño o moderador) ----------
    def delete(self, codigo: str, actual_id: int) -> None:
        invitacion = self._buscar_o_404(codigo)
        servidor = self.permisos.obtener_servidor(invitacion.servidor_id)
        if invitacion.creador_id != actual_id and not self.permisos.es_moderador(servidor, actual_id):
            raise ForbiddenError("Solo quien creó la invitación, el dueño o un moderador pueden borrarla")
        self.invitaciones.delete(invitacion)
        self.db.commit()

    # ---------- HU6: unirse con una invitación ----------
    def usar(self, codigo: str, actual_id: int) -> ServidorResponseDTO:
        invitacion = self._buscar_o_404(codigo)
        servidor = self.permisos.obtener_servidor(invitacion.servidor_id)

        # Rechazos de la HU6, en orden:
        if invitacion.fecha_vencimiento <= ahora():
            raise UnprocessableError("La invitación está vencida")
        if invitacion.usos >= invitacion.usos_maximos:
            raise UnprocessableError("La invitación ya alcanzó su máximo de usos")

        miembro = self.miembros.find(actual_id, servidor.id)
        if miembro is not None and miembro.baneado:
            raise ForbiddenError("Estás baneado de este servidor")
        if miembro is not None:
            raise ConflictError("Ya sos miembro de este servidor")

        everyone = self.roles.find_everyone(servidor.id)
        try:
            # Primero se reserva el uso (de forma segura); si ya no quedaba, se corta.
            if not self.invitaciones.sumar_uso(invitacion.id):
                raise UnprocessableError("La invitación ya alcanzó su máximo de usos")
            self.miembros.create(usuario_id=actual_id, servidor_id=servidor.id)
            if everyone is not None:
                self.roles.asignar(usuario_id=actual_id, rol_id=everyone.id)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

        return to_servidor_response(servidor)

    # ---------- Ayudas internas ----------
    def _buscar_o_404(self, codigo: str) -> Invitacion:
        invitacion = self.invitaciones.find_by_codigo(codigo.strip().upper())
        if invitacion is None:
            raise NotFoundError("Invitación no encontrada")
        return invitacion

    def _generar_codigo_unico(self) -> str:
        """Código aleatorio de 8 caracteres, ej: 'K7P2QX9M'. Si por casualidad
        ya existe, se genera otro."""
        while True:
            codigo = "".join(secrets.choice(CARACTERES_CODIGO) for _ in range(LARGO_CODIGO))
            if self.invitaciones.find_by_codigo(codigo) is None:
                return codigo
