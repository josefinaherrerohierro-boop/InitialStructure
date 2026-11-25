from datetime import datetime

from pydantic import BaseModel


class RedSocialDTO(BaseModel):
    red: str
    url: str

    model_config = {"from_attributes": True}


class FotoPerfilDTO(BaseModel):
    id: int
    url: str
    principal: bool
    # Solo se manda en tu propio perfil (a los demás no les importa).
    visibilidad: str | None = None

    model_config = {"from_attributes": True}


class PerfilDTO(BaseModel):
    id: int
    username: str
    bio: str | None
    avatar_url: str | None
    fecha_registro: datetime
    etiquetas: list[str]
    redes: list[RedSocialDTO]
    fotos: list[FotoPerfilDTO]
    # 'yo', 'amigos', 'enviada' (yo le mandé solicitud), 'recibida' o 'ninguna'
    relacion: str
    servidores_en_comun: int


class UpdatePerfilDTO(BaseModel):
    bio: str | None = None
    etiquetas: list[str] | None = None
    redes: list[RedSocialDTO] | None = None


class HistorialServidorDTO(BaseModel):
    id: int
    servidor_id: int | None  # None si el servidor ya no existe
    servidor_nombre: str
    fecha_union: datetime
    fecha_salida: datetime | None
    motivo_salida: str | None
    sigue_existiendo: bool
