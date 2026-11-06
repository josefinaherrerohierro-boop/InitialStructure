from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from src.db.connection import Base


class Usuario(Base):
    """Tabla `usuarios` (HU1). Debe coincidir con db/tables.sql."""

    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True)
    email = Column(String(150), unique=True, nullable=False)
    username = Column(String(32), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)  # nunca se expone al cliente
    fecha_registro = Column(DateTime, nullable=False, server_default=func.now())
