from datetime import datetime

from pydantic import BaseModel

from src.dtos.social_dto import UsuarioResumenDTO


class FlyerDTO(BaseModel):
    """Tarjeta para unirse a un servidor desde una publicación o un estado."""

    codigo: str
    servidor_id: int
    servidor_nombre: str
    servidor_icono_url: str | None = None
    miembros: int
    vigente: bool  # False si la invitación venció o se quedó sin usos
    soy_miembro: bool


class CreatePublicacionDTO(BaseModel):
    contenido: str = ""
    imagen_url: str | None = None
    servidor_id: int | None = None  # None = publicación del perfil
    promocionar_servidor_id: int | None = None  # flyer: servidor al que se invita


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
    flyer: FlyerDTO | None = None


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
    promocionar_servidor_id: int | None = None  # flyer


class EstadoDTO(BaseModel):
    id: int
    contenido: str
    imagen_url: str | None
    color_fondo: str
    fecha: datetime
    vence: datetime
    flyer: FlyerDTO | None = None

    model_config = {"from_attributes": True}


class EstadosDeUsuarioDTO(BaseModel):
    usuario: UsuarioResumenDTO
    estados: list[EstadoDTO]
