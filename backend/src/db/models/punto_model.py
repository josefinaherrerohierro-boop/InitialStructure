from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from src.db.connection import Base


class Punto(Base):
    """Tabla `puntos`: cada fila suma (o resta) puntos en el scoreboard de un servidor."""

    __tablename__ = "puntos"

    id = Column(Integer, primary_key=True)
    servidor_id = Column(Integer, ForeignKey("servidores.id", ondelete="CASCADE"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    otorgado_por = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    cantidad = Column(Integer, nullable=False)
    motivo = Column(String(100), nullable=False, default="")
    fecha = Column(DateTime, nullable=False, server_default=func.now())
