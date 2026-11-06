from sqlalchemy.orm import Session

from src.db.models.invitacion_model import Invitacion


class InvitacionRepository:
    """Consultas a la tabla `invitaciones`. Hace flush; el service confirma (commit)."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, servidor_id: int, creador_id: int, codigo: str, usos_maximos: int, fecha_vencimiento) -> Invitacion:
        invitacion = Invitacion(
            servidor_id=servidor_id,
            creador_id=creador_id,
            codigo=codigo,
            usos_maximos=usos_maximos,
            usos=0,
            fecha_vencimiento=fecha_vencimiento,
        )
        self.db.add(invitacion)
        self.db.flush()
        return invitacion

    def find_by_codigo(self, codigo: str) -> Invitacion | None:
        return self.db.query(Invitacion).filter(Invitacion.codigo == codigo).first()

    def list_by_servidor(self, servidor_id: int) -> list[Invitacion]:
        return (
            self.db.query(Invitacion)
            .filter(Invitacion.servidor_id == servidor_id)
            .order_by(Invitacion.id.desc())
            .all()
        )

    def sumar_uso(self, invitacion_id: int) -> bool:
        """Suma 1 a `usos` SOLO si todavía no llegó al máximo.

        Se hace en una sola sentencia UPDATE ... WHERE usos < usos_maximos,
        así dos personas usando el último lugar al mismo tiempo no pueden
        pasarse del límite. Devuelve False si ya no quedaban usos.
        """
        filas = (
            self.db.query(Invitacion)
            .filter(Invitacion.id == invitacion_id, Invitacion.usos < Invitacion.usos_maximos)
            .update({Invitacion.usos: Invitacion.usos + 1}, synchronize_session="fetch")
        )
        self.db.flush()
        return filas == 1

    def delete(self, invitacion: Invitacion) -> None:
        self.db.delete(invitacion)
        self.db.flush()
