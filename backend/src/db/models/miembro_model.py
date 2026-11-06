from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer
from sqlalchemy.sql import func

from src.db.connection import Base


class Miembro(Base):
    """Tabla `miembros`: relación N a M entre usuarios y servidores.

    Expulsar = borrar la fila. Banear = dejar la fila con baneado = True.
    """

    __tablename__ = "miembros"

    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    servidor_id = Column(Integer, ForeignKey("servidores.id", ondelete="CASCADE"), primary_key=True)
    fecha_union = Column(DateTime, nullable=False, server_default=func.now())
    baneado = Column(Boolean, nullable=False, default=False)
