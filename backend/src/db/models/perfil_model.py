"""Tablas del perfil del usuario: etiquetas, redes sociales y fotos."""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from src.db.connection import Base

REDES_PERMITIDAS = ("instagram", "x", "tiktok", "youtube", "twitch", "github", "spotify", "linkedin", "web")


class EtiquetaUsuario(Base):
    __tablename__ = "etiquetas_usuario"

    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    etiqueta = Column(String(24), primary_key=True)


class RedSocial(Base):
    __tablename__ = "redes_sociales"

    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    red = Column(String(20), primary_key=True)
    url = Column(String(255), nullable=False)


class FotoPerfil(Base):
    __tablename__ = "fotos_perfil"

    id = Column(Integer, primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    url = Column(String(255), nullable=False)
    principal = Column(Boolean, nullable=False, default=False)
    fecha = Column(DateTime, nullable=False, server_default=func.now())
