from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from src.db.connection import Base


class Servidor(Base):
    """Tabla `servidores` (HU2, HU10)."""

    __tablename__ = "servidores"

    id = Column(Integer, primary_key=True)
    nombre = Column(String(100), nullable=False)
    duenio_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    fecha_creacion = Column(DateTime, nullable=False, server_default=func.now())
