from sqlalchemy.orm import Session

from src.db.models.notificacion_model import Notificacion
from src.utils.fechas import ahora


class NotificacionRepository:
    """Consultas a `notificaciones`. Hace flush; el service confirma (commit)."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, **campos) -> Notificacion:
        notificacion = Notificacion(**campos)
        self.db.add(notificacion)
        self.db.flush()
        return notificacion

    def list_de_usuario(self, usuario_id: int, limite: int = 30) -> list[Notificacion]:
        return (
            self.db.query(Notificacion)
            .filter(Notificacion.usuario_id == usuario_id)
            .order_by(Notificacion.fecha.desc(), Notificacion.id.desc())
            .limit(limite)
            .all()
        )

    def contar_no_leidas(self, usuario_id: int) -> int:
        return (
            self.db.query(Notificacion)
            .filter(Notificacion.usuario_id == usuario_id, Notificacion.leida.is_(False))
            .count()
        )

    def dm_no_leida(self, usuario_id: int, actor_id: int) -> Notificacion | None:
        """El aviso de mensaje privado sin leer de esa persona (para no repetir uno por mensaje)."""
        return (
            self.db.query(Notificacion)
            .filter(
                Notificacion.usuario_id == usuario_id,
                Notificacion.actor_id == actor_id,
                Notificacion.tipo == "mensaje_directo",
                Notificacion.leida.is_(False),
            )
            .first()
        )

    def renovar(self, notificacion: Notificacion, texto: str) -> None:
        notificacion.texto = texto
        notificacion.fecha = ahora()
        self.db.flush()

    def marcar_leidas(self, usuario_id: int, ids: list[int] | None = None) -> int:
        """Marca como leídas las indicadas (o todas, si ids es None). Devuelve cuántas cambió."""
        consulta = self.db.query(Notificacion).filter(Notificacion.usuario_id == usuario_id, Notificacion.leida.is_(False))
        if ids is not None:
            consulta = consulta.filter(Notificacion.id.in_(ids))
        cambiadas = consulta.update({Notificacion.leida: True}, synchronize_session=False)
        self.db.flush()
        return cambiadas

    def marcar_leidas_de(self, usuario_id: int, tipo: str, canal_id: int | None = None, actor_id: int | None = None) -> int:
        """Al abrir un canal o una conversación, sus avisos quedan leídos."""
        consulta = self.db.query(Notificacion).filter(
            Notificacion.usuario_id == usuario_id, Notificacion.tipo == tipo, Notificacion.leida.is_(False)
        )
        if canal_id is not None:
            consulta = consulta.filter(Notificacion.canal_id == canal_id)
        if actor_id is not None:
            consulta = consulta.filter(Notificacion.actor_id == actor_id)
        cambiadas = consulta.update({Notificacion.leida: True}, synchronize_session=False)
        self.db.flush()
        return cambiadas
