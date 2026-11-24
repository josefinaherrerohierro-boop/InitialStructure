from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from src.db.connection import Base


class Publicacion(Base):
    """Tabla `publicaciones`. servidor_id NULL = publicación del perfil."""

    __tablename__ = "publicaciones"

    id = Column(Integer, primary_key=True)
    autor_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    servidor_id = Column(Integer, ForeignKey("servidores.id", ondelete="CASCADE"), nullable=True)
    contenido = Column(Text, nullable=False, default="")
    imagen_url = Column(String(255), nullable=True)
    fecha = Column(DateTime, nullable=False, server_default=func.now())


class PublicacionLike(Base):
    __tablename__ = "publicacion_likes"

    publicacion_id = Column(Integer, ForeignKey("publicaciones.id", ondelete="CASCADE"), primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)


class PublicacionComentario(Base):
    __tablename__ = "publicacion_comentarios"

    id = Column(Integer, primary_key=True)
    publicacion_id = Column(Integer, ForeignKey("publicaciones.id", ondelete="CASCADE"), nullable=False)
    autor_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    contenido = Column(String(500), nullable=False)
    fecha = Column(DateTime, nullable=False, server_default=func.now())
