from sqlalchemy import Column, ForeignKey, Integer

from src.db.connection import Base


class RolMiembro(Base):
    """Tabla `roles_miembro`: qué roles tiene cada usuario (N a M)."""

    __tablename__ = "roles_miembro"

    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    rol_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
