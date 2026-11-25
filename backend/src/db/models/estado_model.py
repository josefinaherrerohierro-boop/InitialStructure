from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from src.db.connection import Base

DURACION_ESTADO_HORAS = 24


class Estado(Base):
    """Tabla `estados`: texto o imagen que se ve durante 24 horas."""

    __tablename__ = "estados"

    id = Column(Integer, primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    contenido = Column(String(200), nullable=False, default="")
    imagen_url = Column(String(255), nullable=True)
    color_fondo = Column(String(7), nullable=False, default="#ff6b5b")
    invitacion_id = Column(Integer, ForeignKey("invitaciones.id", ondelete="SET NULL"), nullable=True)  # flyer
    fecha = Column(DateTime, nullable=False, server_default=func.now())
    vence = Column(DateTime, nullable=False)
