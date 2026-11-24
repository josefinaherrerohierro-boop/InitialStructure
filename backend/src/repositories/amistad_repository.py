from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from src.db.models.amistad_model import Amistad


class AmistadRepository:
    """Consultas a la tabla `amistades`. Hace flush; el service confirma (commit)."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, solicitante_id: int, receptor_id: int) -> Amistad:
        amistad = Amistad(solicitante_id=solicitante_id, receptor_id=receptor_id, estado="pendiente")
        self.db.add(amistad)
        self.db.flush()
        return amistad

    def find_by_id(self, amistad_id: int) -> Amistad | None:
        return self.db.query(Amistad).filter(Amistad.id == amistad_id).first()

    def find_entre(self, usuario_a: int, usuario_b: int) -> Amistad | None:
        """La fila de esos dos usuarios, sin importar quién la pidió."""
        return (
            self.db.query(Amistad)
            .filter(
                or_(
                    and_(Amistad.solicitante_id == usuario_a, Amistad.receptor_id == usuario_b),
                    and_(Amistad.solicitante_id == usuario_b, Amistad.receptor_id == usuario_a),
                )
            )
            .first()
        )

    def list_de_usuario(self, usuario_id: int, estado: str) -> list[Amistad]:
        return (
            self.db.query(Amistad)
            .filter(
                Amistad.estado == estado,
                or_(Amistad.solicitante_id == usuario_id, Amistad.receptor_id == usuario_id),
            )
            .order_by(Amistad.fecha.desc())
            .all()
        )

    def ids_de_amigos(self, usuario_id: int) -> list[int]:
        return [a.otro(usuario_id) for a in self.list_de_usuario(usuario_id, "aceptada")]

    def update(self, amistad: Amistad, **campos) -> Amistad:
        for nombre, valor in campos.items():
            setattr(amistad, nombre, valor)
        self.db.flush()
        return amistad

    def delete(self, amistad: Amistad) -> None:
        self.db.delete(amistad)
        self.db.flush()
