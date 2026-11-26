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
    # Servidores temporales: al llegar a esta fecha se borran solos. NULL = permanente.
    expira_en = Column(DateTime, nullable=True)
    icono_url = Column(String(255), nullable=True)  # foto del servidor
    # Contraseña para borrarlo (bcrypt). Nunca sale del backend. NULL = se usa la de la cuenta del dueño.
    clave_borrado_hash = Column(String(255), nullable=True)
