from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String

from src.db.connection import Base


class Encuesta(Base):
    """Tabla `encuestas`. Se publica como un mensaje: la pregunta es su contenido."""

    __tablename__ = "encuestas"

    id = Column(Integer, primary_key=True)
    mensaje_id = Column(Integer, ForeignKey("mensajes.id", ondelete="CASCADE"), nullable=False, unique=True)
    multiple = Column(Boolean, nullable=False, default=False)  # se pueden elegir varias opciones
    fecha_limite = Column(DateTime, nullable=True)  # NULL = sin fecha límite


class OpcionEncuesta(Base):
    __tablename__ = "opciones_encuesta"

    id = Column(Integer, primary_key=True)
    encuesta_id = Column(Integer, ForeignKey("encuestas.id", ondelete="CASCADE"), nullable=False)
    texto = Column(String(100), nullable=False)
    orden = Column(Integer, nullable=False, default=0)


class VotoEncuesta(Base):
    __tablename__ = "votos_encuesta"

    encuesta_id = Column(Integer, ForeignKey("encuestas.id", ondelete="CASCADE"), nullable=False)
    opcion_id = Column(Integer, ForeignKey("opciones_encuesta.id", ondelete="CASCADE"), primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
