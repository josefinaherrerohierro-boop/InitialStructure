from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from src.db.connection import Base


class Evento(Base):
    """Tabla `eventos`: el calendario de cada servidor."""

    __tablename__ = "eventos"

    id = Column(Integer, primary_key=True)
    servidor_id = Column(Integer, ForeignKey("servidores.id", ondelete="CASCADE"), nullable=False)
    creador_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    titulo = Column(String(100), nullable=False)
    descripcion = Column(String(1000), nullable=False, default="")
    lugar = Column(String(100), nullable=False, default="")
    inicio = Column(DateTime, nullable=False)
    fin = Column(DateTime, nullable=True)


class EventoAsistente(Base):
    __tablename__ = "evento_asistentes"

    evento_id = Column(Integer, ForeignKey("eventos.id", ondelete="CASCADE"), primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
