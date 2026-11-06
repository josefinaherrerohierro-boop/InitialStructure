from sqlalchemy.orm import Session

from src.db.models.miembro_model import Miembro
from src.db.models.usuario_model import Usuario


class MiembroRepository:
    """Consultas a la tabla `miembros`. Hace flush; el service confirma (commit)."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, usuario_id: int, servidor_id: int) -> Miembro:
        miembro = Miembro(usuario_id=usuario_id, servidor_id=servidor_id)
        self.db.add(miembro)
        self.db.flush()
        return miembro

    def find(self, usuario_id: int, servidor_id: int) -> Miembro | None:
        """Devuelve la fila aunque esté baneado (el service decide qué hacer)."""
        return (
            self.db.query(Miembro)
            .filter(Miembro.usuario_id == usuario_id, Miembro.servidor_id == servidor_id)
            .first()
        )

    def list_activos(self, servidor_id: int) -> list[tuple[Miembro, Usuario]]:
        """Miembros no baneados del servidor, junto con su usuario (para el username)."""
        return (
            self.db.query(Miembro, Usuario)
            .join(Usuario, Usuario.id == Miembro.usuario_id)
            .filter(Miembro.servidor_id == servidor_id, Miembro.baneado.is_(False))
            .order_by(Miembro.fecha_union)
            .all()
        )

    def marcar_baneado(self, miembro: Miembro) -> None:
        miembro.baneado = True
        self.db.flush()

    def delete(self, miembro: Miembro) -> None:
        self.db.delete(miembro)
        self.db.flush()
