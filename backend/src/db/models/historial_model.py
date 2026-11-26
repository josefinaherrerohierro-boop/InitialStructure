from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from src.db.connection import Base


class HistorialServidor(Base):
    """Tabla `historial_servidores`: cada vez que alguien entra a un servidor
    se agrega una fila; cuando sale, se completan fecha_salida y el motivo
    ('salio', 'expulsado', 'baneado', 'servidor_borrado', 'servidor_vencido')."""

    __tablename__ = "historial_servidores"

    id = Column(Integer, primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    servidor_id = Column(Integer, ForeignKey("servidores.id", ondelete="SET NULL"), nullable=True)
    servidor_nombre = Column(String(100), nullable=False)
    fecha_union = Column(DateTime, nullable=False, server_default=func.now())
    fecha_salida = Column(DateTime, nullable=True)
    motivo_salida = Column(String(20), nullable=True)
    # Roles que tenía al salir, como lista JSON (ej: '["Dueño", "Moderador"]').
    roles = Column(Text, nullable=True)
