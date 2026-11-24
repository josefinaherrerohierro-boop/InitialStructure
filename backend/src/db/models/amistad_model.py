from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from src.db.connection import Base


class Amistad(Base):
    """Tabla `amistades`: una fila por par de usuarios ('pendiente' o 'aceptada')."""

    __tablename__ = "amistades"

    id = Column(Integer, primary_key=True)
    solicitante_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    receptor_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    estado = Column(String(10), nullable=False, default="pendiente")
    fecha = Column(DateTime, nullable=False, server_default=func.now())
    fecha_respuesta = Column(DateTime, nullable=True)

    def otro(self, usuario_id: int) -> int:
        """El id de la otra persona de la amistad."""
        return self.receptor_id if self.solicitante_id == usuario_id else self.solicitante_id
