from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from src.db.connection import Base

LARGO_MAXIMO_MENSAJE = 2000
TIPOS_ADJUNTO = ("imagen", "audio", "video", "archivo")


class Mensaje(Base):
    """Tabla `mensajes` (HU7, HU8). Puede llevar un archivo adjunto y estar fijado."""

    __tablename__ = "mensajes"

    id = Column(Integer, primary_key=True)
    canal_id = Column(Integer, ForeignKey("canales.id", ondelete="CASCADE"), nullable=False)
    autor_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    contenido = Column(Text, nullable=False, default="")
    fecha = Column(DateTime, nullable=False, server_default=func.now())
    editado = Column(Boolean, nullable=False, default=False)
    adjunto_url = Column(String(255), nullable=True)
    adjunto_tipo = Column(String(10), nullable=True)  # 'imagen', 'audio', 'video' o 'archivo'
    adjunto_nombre = Column(String(255), nullable=True)
    fijado = Column(Boolean, nullable=False, default=False)
