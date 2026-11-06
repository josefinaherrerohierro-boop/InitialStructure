from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String

from src.db.connection import Base


class Invitacion(Base):
    """Tabla `invitaciones` (HU5, HU6)."""

    __tablename__ = "invitaciones"
    __table_args__ = (
        CheckConstraint("usos_maximos > 0"),
        CheckConstraint("usos >= 0 AND usos <= usos_maximos", name="chk_usos_validos"),
    )

    id = Column(Integer, primary_key=True)
    servidor_id = Column(Integer, ForeignKey("servidores.id", ondelete="CASCADE"), nullable=False)
    creador_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    codigo = Column(String(20), unique=True, nullable=False)
    usos_maximos = Column(Integer, nullable=False)
    usos = Column(Integer, nullable=False, default=0)
    fecha_vencimiento = Column(DateTime, nullable=False)
