from datetime import datetime

from pydantic import BaseModel

from src.dtos.social_dto import UsuarioResumenDTO


class CreatePublicacionDTO(BaseModel):
    contenido: str = ""
    imagen_url: str | None = None
    servidor_id: int | None = None  # None = publicación del perfil


class PublicacionDTO(BaseModel):
    id: int
    autor: UsuarioResumenDTO
    servidor_id: int | None
    contenido: str
    imagen_url: str | None
    fecha: datetime
    likes: int
    me_gusta: bool
    comentarios: int


class ComentarioDTO(BaseModel):
    id: int
    publicacion_id: int
    autor: UsuarioResumenDTO
    contenido: str
    fecha: datetime


class CreateEstadoDTO(BaseModel):
    contenido: str = ""
    imagen_url: str | None = None
    color_fondo: str = "#ff6b5b"


class EstadoDTO(BaseModel):
    id: int
    contenido: str
    imagen_url: str | None
    color_fondo: str
    fecha: datetime
    vence: datetime

    model_config = {"from_attributes": True}


class EstadosDeUsuarioDTO(BaseModel):
    usuario: UsuarioResumenDTO
    estados: list[EstadoDTO]
