from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from src.db.connection import Base


class MensajeDirecto(Base):
    """Tabla `mensajes_directos`: chat privado entre dos usuarios."""

    __tablename__ = "mensajes_directos"

    id = Column(Integer, primary_key=True)
    remitente_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    destinatario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    contenido = Column(Text, nullable=False, default="")
    fecha = Column(DateTime, nullable=False, server_default=func.now())
    editado = Column(Boolean, nullable=False, default=False)
    leido = Column(Boolean, nullable=False, default=False)
    adjunto_url = Column(String(255), nullable=True)
    adjunto_tipo = Column(String(10), nullable=True)
    adjunto_nombre = Column(String(255), nullable=True)
