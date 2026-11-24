from sqlalchemy import Boolean, Column, ForeignKey, Integer, String

from src.db.connection import Base

TEMAS = ("oscuro", "medianoche", "claro", "bosque", "atardecer")
FUENTES = ("geist", "inter", "nunito", "lora", "space-grotesk", "atkinson", "mono")


class Preferencias(Base):
    """Tabla `preferencias`: la apariencia que eligió cada usuario."""

    __tablename__ = "preferencias"

    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    tema = Column(String(20), nullable=False, default="oscuro")
    color_primario = Column(String(7), nullable=False, default="#ff6b5b")
    fuente = Column(String(20), nullable=False, default="geist")
    tamanio_fuente = Column(Integer, nullable=False, default=16)
    compacto = Column(Boolean, nullable=False, default=False)
