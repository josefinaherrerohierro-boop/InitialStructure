from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import Session

from src.db.models.mensaje_directo_model import MensajeDirecto


def _entre(a: int, b: int):
    return or_(
        and_(MensajeDirecto.remitente_id == a, MensajeDirecto.destinatario_id == b),
        and_(MensajeDirecto.remitente_id == b, MensajeDirecto.destinatario_id == a),
    )


class MensajeDirectoRepository:
    """Consultas a `mensajes_directos`. Hace flush; el service confirma (commit)."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, remitente_id: int, destinatario_id: int, contenido: str, adjunto=None) -> MensajeDirecto:
        mensaje = MensajeDirecto(
            remitente_id=remitente_id,
            destinatario_id=destinatario_id,
            contenido=contenido,
            editado=False,
            leido=False,
            adjunto_url=adjunto.url if adjunto else None,
            adjunto_tipo=adjunto.tipo if adjunto else None,
            adjunto_nombre=adjunto.nombre if adjunto else None,
        )
        self.db.add(mensaje)
        self.db.flush()
        return mensaje

    def find_by_id(self, mensaje_id: int) -> MensajeDirecto | None:
        return self.db.query(MensajeDirecto).filter(MensajeDirecto.id == mensaje_id).first()

    def list_conversacion(
        self, usuario_a: int, usuario_b: int, limite: int, antes_de: int | None = None
    ) -> list[MensajeDirecto]:
        """Igual que los canales: los más recientes, devueltos del más viejo al más nuevo."""
        consulta = self.db.query(MensajeDirecto).filter(_entre(usuario_a, usuario_b))
        if antes_de is not None:
            consulta = consulta.filter(MensajeDirecto.id < antes_de)
        return list(reversed(consulta.order_by(MensajeDirecto.id.desc()).limit(limite).all()))

    def marcar_leidos(self, lector_id: int, remitente_id: int) -> None:
        self.db.query(MensajeDirecto).filter(
            MensajeDirecto.destinatario_id == lector_id,
            MensajeDirecto.remitente_id == remitente_id,
            MensajeDirecto.leido.is_(False),
        ).update({MensajeDirecto.leido: True}, synchronize_session=False)
        self.db.flush()

    def ultimos_por_conversacion(self, usuario_id: int) -> list[MensajeDirecto]:
        """El último mensaje de cada conversación del usuario, de la más reciente a la más vieja."""
        otro = case(
            (MensajeDirecto.remitente_id == usuario_id, MensajeDirecto.destinatario_id),
            else_=MensajeDirecto.remitente_id,
        )
        ultimos = (
            self.db.query(func.max(MensajeDirecto.id))
            .filter(or_(MensajeDirecto.remitente_id == usuario_id, MensajeDirecto.destinatario_id == usuario_id))
            .group_by(otro)
            .subquery()
        )
        return (
            self.db.query(MensajeDirecto)
            .filter(MensajeDirecto.id.in_(ultimos.select()))
            .order_by(MensajeDirecto.id.desc())
            .all()
        )

    def no_leidos_por_remitente(self, usuario_id: int) -> dict[int, int]:
        filas = (
            self.db.query(MensajeDirecto.remitente_id, func.count())
            .filter(MensajeDirecto.destinatario_id == usuario_id, MensajeDirecto.leido.is_(False))
            .group_by(MensajeDirecto.remitente_id)
            .all()
        )
        return dict(filas)

    def update(self, mensaje: MensajeDirecto, **campos) -> MensajeDirecto:
        for nombre, valor in campos.items():
            setattr(mensaje, nombre, valor)
        self.db.flush()
        return mensaje

    def delete(self, mensaje: MensajeDirecto) -> None:
        self.db.delete(mensaje)
        self.db.flush()
