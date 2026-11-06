from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.sql import func

from src.db.connection import Base

LARGO_MAXIMO_MENSAJE = 2000


class Mensaje(Base):
    """Tabla `mensajes` (HU7, HU8)."""

    __tablename__ = "mensajes"

    id = Column(Integer, primary_key=True)
    canal_id = Column(Integer, ForeignKey("canales.id", ondelete="CASCADE"), nullable=False)
    autor_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    contenido = Column(Text, nullable=False)
    fecha = Column(DateTime, nullable=False, server_default=func.now())
    editado = Column(Boolean, nullable=False, default=False)
