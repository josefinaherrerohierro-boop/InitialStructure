from sqlalchemy import func
from sqlalchemy.orm import Session

from src.db.models.reaccion_model import Reaccion


class ReaccionRepository:
    """Consultas a la tabla `reacciones`. Hace flush; el service confirma (commit)."""

    def __init__(self, db: Session):
        self.db = db

    def find(self, mensaje_id: int, usuario_id: int, emoji: str) -> Reaccion | None:
        return (
            self.db.query(Reaccion)
            .filter(Reaccion.mensaje_id == mensaje_id, Reaccion.usuario_id == usuario_id, Reaccion.emoji == emoji)
            .first()
        )

    def create(self, mensaje_id: int, usuario_id: int, emoji: str) -> Reaccion:
        reaccion = Reaccion(mensaje_id=mensaje_id, usuario_id=usuario_id, emoji=emoji)
        self.db.add(reaccion)
        self.db.flush()
        return reaccion

    def delete(self, reaccion: Reaccion) -> None:
        self.db.delete(reaccion)
        self.db.flush()

    def emojis_distintos(self, mensaje_id: int) -> set[str]:
        filas = self.db.query(Reaccion.emoji).filter(Reaccion.mensaje_id == mensaje_id).distinct().all()
        return {e for (e,) in filas}

    def list_by_mensajes(self, mensaje_ids: list[int]) -> list[Reaccion]:
        if not mensaje_ids:
            return []
        return (
            self.db.query(Reaccion)
            .filter(Reaccion.mensaje_id.in_(mensaje_ids))
            .order_by(Reaccion.fecha, Reaccion.usuario_id)
            .all()
        )

    def emojis_mas_usados(self, usuario_id: int, desde, hasta, limite: int = 3) -> list[tuple[str, int]]:
        """Los emojis con los que más reaccionó un usuario (para el Wrapped)."""
        return (
            self.db.query(Reaccion.emoji, func.count())
            .filter(Reaccion.usuario_id == usuario_id, Reaccion.fecha >= desde, Reaccion.fecha < hasta)
            .group_by(Reaccion.emoji)
            .order_by(func.count().desc())
            .limit(limite)
            .all()
        )
