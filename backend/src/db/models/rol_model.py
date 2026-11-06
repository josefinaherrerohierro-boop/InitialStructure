from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, UniqueConstraint

from src.db.connection import Base

# Nombre del rol que se crea automáticamente en cada servidor (HU2).
ROL_EVERYONE = "@everyone"


class Rol(Base):
    """Tabla `roles` (HU4). El nombre es único dentro de cada servidor."""

    __tablename__ = "roles"
    __table_args__ = (UniqueConstraint("servidor_id", "nombre", name="uq_rol_nombre_por_servidor"),)

    id = Column(Integer, primary_key=True)
    servidor_id = Column(Integer, ForeignKey("servidores.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(50), nullable=False)
    puede_escribir = Column(Boolean, nullable=False, default=False)
    puede_moderar = Column(Boolean, nullable=False, default=False)
    puede_invitar = Column(Boolean, nullable=False, default=False)
