from datetime import datetime

from sqlalchemy import and_, desc, exists, func
from sqlalchemy.orm import Session

from src.db.models.canal_model import Canal
from src.db.models.mensaje_model import Mensaje
from src.db.models.miembro_model import Miembro
from src.db.models.usuario_model import Usuario


def _mes(columna):
    """Convierte una fecha en el texto 'AAAA-MM' (ej: '2026-11') para agrupar por mes."""
    return func.to_char(func.date_trunc("month", columna), "YYYY-MM")


class EstadisticasRepository:
    """Consultas "no CRUD" que responden preguntas del negocio (HU11, HU12)."""

    def __init__(self, db: Session):
        self.db = db

    # ---------- HU11: top usuarios ----------
    def top_usuarios(self, servidor_id: int, desde: datetime, limite: int = 10):
        """Los miembros (no baneados) con más mensajes en el servidor desde `desde`."""
        cantidad = func.count(Mensaje.id).label("cantidad_mensajes")
        return (
            self.db.query(Usuario.id, Usuario.username, cantidad)
            .join(Mensaje, Mensaje.autor_id == Usuario.id)
            .join(Canal, Canal.id == Mensaje.canal_id)
            # Solo cuentan quienes hoy son miembros del servidor:
            .join(
                Miembro,
                and_(
                    Miembro.usuario_id == Usuario.id,
                    Miembro.servidor_id == Canal.servidor_id,
                    Miembro.baneado.is_(False),
                ),
            )
            .filter(Canal.servidor_id == servidor_id, Mensaje.fecha >= desde)
            .group_by(Usuario.id, Usuario.username)
            .order_by(desc(cantidad), Usuario.username)
            .limit(limite)
            .all()
        )

    # ---------- HU11: canales inactivos ----------
    def canales_inactivos(self, servidor_id: int, desde: datetime):
        """Canales de TEXTO del servidor sin ningún mensaje desde `desde`.
        También devuelve la fecha de su último mensaje (o None si nunca tuvo)."""
        mensaje_reciente = exists().where(Mensaje.canal_id == Canal.id, Mensaje.fecha >= desde)
        ultimo_mensaje = (
            self.db.query(func.max(Mensaje.fecha))
            .filter(Mensaje.canal_id == Canal.id)
            .correlate(Canal)
            .scalar_subquery()
        )
        return (
            self.db.query(Canal.id, Canal.nombre, ultimo_mensaje.label("ultimo_mensaje"))
            .filter(Canal.servidor_id == servidor_id, Canal.tipo == "texto", ~mensaje_reciente)
            .order_by(Canal.id)
            .all()
        )

    # ---------- HU12: crecimiento ----------
    def miembros_por_mes(self, servidor_id: int):
        mes = _mes(Miembro.fecha_union).label("mes")
        return (
            self.db.query(mes, func.count().label("cantidad"))
            .filter(Miembro.servidor_id == servidor_id)
            .group_by(mes)
            .order_by(mes)
            .all()
        )

    def total_miembros_actuales(self, servidor_id: int) -> int:
        return (
            self.db.query(func.count())
            .select_from(Miembro)
            .filter(Miembro.servidor_id == servidor_id, Miembro.baneado.is_(False))
            .scalar()
        )

    def mensajes_por_mes(self, servidor_id: int):
        mes = _mes(Mensaje.fecha).label("mes")
        return (
            self.db.query(mes, func.count(Mensaje.id).label("cantidad"))
            .join(Canal, Canal.id == Mensaje.canal_id)
            .filter(Canal.servidor_id == servidor_id)
            .group_by(mes)
            .order_by(mes)
            .all()
        )
