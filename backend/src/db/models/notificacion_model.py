from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from src.db.connection import Base

# Tipos de aviso. Los "importantes" suenan en el navegador (ver el frontend).
TIPOS_NOTIFICACION = ("mencion", "mensaje_directo", "solicitud_amistad", "amistad_aceptada", "tarea_asignada")


class Notificacion(Base):
    """Tabla `notificaciones`: avisos para un usuario (lo mencionaron, le
    escribieron por privado, le mandaron una solicitud de amistad, etc.).
    El texto se guarda ya armado; los id sirven para llevarlo al lugar."""

    __tablename__ = "notificaciones"

    id = Column(Integer, primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    tipo = Column(String(20), nullable=False)
    actor_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    texto = Column(String(200), nullable=False)
    servidor_id = Column(Integer, ForeignKey("servidores.id", ondelete="CASCADE"), nullable=True)
    canal_id = Column(Integer, ForeignKey("canales.id", ondelete="CASCADE"), nullable=True)
    mensaje_id = Column(Integer, ForeignKey("mensajes.id", ondelete="CASCADE"), nullable=True)
    leida = Column(Boolean, nullable=False, default=False)
    fecha = Column(DateTime, nullable=False, server_default=func.now())
