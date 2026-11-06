from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, UniqueConstraint

from src.db.connection import Base

TIPOS_CANAL = ("texto", "voz")


class Canal(Base):
    """Tabla `canales` (HU3). El nombre es único dentro de cada servidor."""

    __tablename__ = "canales"
    __table_args__ = (UniqueConstraint("servidor_id", "nombre", name="uq_canal_nombre_por_servidor"),)

    id = Column(Integer, primary_key=True)
    servidor_id = Column(Integer, ForeignKey("servidores.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(100), nullable=False)
    tipo = Column(String(10), nullable=False)  # 'texto' o 'voz'
    solo_lectura = Column(Boolean, nullable=False, default=False)
