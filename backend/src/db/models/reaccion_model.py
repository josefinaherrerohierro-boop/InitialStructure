from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from src.db.connection import Base


class Reaccion(Base):
    """Tabla `reacciones`: un emoji que un usuario puso en un mensaje."""

    __tablename__ = "reacciones"

    mensaje_id = Column(Integer, ForeignKey("mensajes.id", ondelete="CASCADE"), primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    emoji = Column(String(32), primary_key=True)
    fecha = Column(DateTime, nullable=False, server_default=func.now())
