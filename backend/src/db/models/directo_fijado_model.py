from sqlalchemy import Column, ForeignKey, Integer

from src.db.connection import Base


class DirectoFijado(Base):
    """Tabla `directos_fijados`: conversaciones que cada uno fijó arriba, en su orden."""

    __tablename__ = "directos_fijados"

    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    otro_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    posicion = Column(Integer, nullable=False, default=0)
