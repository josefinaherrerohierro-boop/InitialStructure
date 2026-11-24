from sqlalchemy.orm import Session, aliased

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

    def apodos(self, servidor_id: int) -> dict[int, str]:
        """{usuario_id: apodo} de los miembros que tienen apodo en el servidor."""
        filas = (
            self.db.query(Miembro.usuario_id, Miembro.apodo)
            .filter(Miembro.servidor_id == servidor_id, Miembro.apodo.isnot(None))
            .all()
        )
        return {usuario_id: apodo for usuario_id, apodo in filas}

    def update(self, miembro: Miembro, **campos) -> Miembro:
        for nombre, valor in campos.items():
            setattr(miembro, nombre, valor)
        self.db.flush()
        return miembro

    def list_de_usuario(self, usuario_id: int) -> list[Miembro]:
        """Todas las membresías activas de un usuario (para reordenar sus servidores)."""
        return (
            self.db.query(Miembro)
            .filter(Miembro.usuario_id == usuario_id, Miembro.baneado.is_(False))
            .all()
        )

    def servidores_en_comun(self, usuario_a: int, usuario_b: int) -> int:
        """Cantidad de servidores donde los dos son miembros (no baneados)."""
        otro = aliased(Miembro)
        return (
            self.db.query(Miembro)
            .join(otro, otro.servidor_id == Miembro.servidor_id)
            .filter(
                Miembro.usuario_id == usuario_a,
                otro.usuario_id == usuario_b,
                Miembro.baneado.is_(False),
                otro.baneado.is_(False),
            )
            .count()
        )

    def marcar_baneado(self, miembro: Miembro) -> None:
        miembro.baneado = True
        self.db.flush()

    def delete(self, miembro: Miembro) -> None:
        self.db.delete(miembro)
        self.db.flush()
