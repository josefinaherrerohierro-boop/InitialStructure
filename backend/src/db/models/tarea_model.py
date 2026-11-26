from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from src.db.connection import Base

ESTADOS_TAREA = ("pendiente", "en_progreso", "hecha")


class Tarea(Base):
    """Tabla `tareas`: tareas de un servidor, asignadas (o no) a un miembro."""

    __tablename__ = "tareas"

    id = Column(Integer, primary_key=True)
    servidor_id = Column(Integer, ForeignKey("servidores.id", ondelete="CASCADE"), nullable=False)
    creador_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    asignado_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    titulo = Column(String(120), nullable=False)
    descripcion = Column(String(1000), nullable=False, default="")
    fecha_limite = Column(DateTime, nullable=True)
    estado = Column(String(12), nullable=False, default="pendiente")
    fecha_creacion = Column(DateTime, nullable=False, server_default=func.now())
    fecha_completada = Column(DateTime, nullable=True)
    imagen_url = Column(String(255), nullable=True)
    # Puntos del scoreboard para quien la complete (los fija un moderador o el dueño).
    puntos = Column(Integer, nullable=False, default=0)
    # A quién se le dieron los puntos al completarla (para descontarlos si se reabre).
    puntos_otorgados_a = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
