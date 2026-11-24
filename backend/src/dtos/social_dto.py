from datetime import datetime

from pydantic import BaseModel

from src.dtos.archivo_dto import AdjuntoDTO


class UsuarioResumenDTO(BaseModel):
    """Datos públicos mínimos de un usuario (para listas de amigos, chats, etc.)."""

    id: int
    username: str
    avatar_url: str | None = None
    bio: str | None = None

    model_config = {"from_attributes": True}


class AmigoDTO(BaseModel):
    usuario: UsuarioResumenDTO
    desde: datetime


class SolicitudDTO(BaseModel):
    id: int
    usuario: UsuarioResumenDTO  # la otra persona
    fecha: datetime


class SolicitudesDTO(BaseModel):
    recibidas: list[SolicitudDTO]
    enviadas: list[SolicitudDTO]


class CreateMensajeDirectoDTO(BaseModel):
    contenido: str = ""
    adjunto: AdjuntoDTO | None = None


class MensajeDirectoResponseDTO(BaseModel):
    """Misma forma que un mensaje de canal (para reusar la vista del chat)."""

    id: int
    autor_id: int
    destinatario_id: int
    autor_username: str
    autor_avatar_url: str | None = None
    contenido: str
    fecha: datetime
    editado: bool
    leido: bool
    adjunto: AdjuntoDTO | None = None


class ConversacionDTO(BaseModel):
    usuario: UsuarioResumenDTO
    ultimo_mensaje: MensajeDirectoResponseDTO
    no_leidos: int
