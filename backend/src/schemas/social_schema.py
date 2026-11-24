from pydantic import BaseModel, Field

from src.schemas.mensaje_schema import AdjuntoSchema
from src.schemas.usuario_schema import USERNAME_PATTERN


class SolicitudAmistadSchema(BaseModel):
    # Se agrega a alguien por su nombre de usuario (como en Discord).
    username: str = Field(min_length=3, max_length=32, pattern=USERNAME_PATTERN)


class CreateMensajeDirectoSchema(BaseModel):
    contenido: str = Field(default="", max_length=2000)
    adjunto: AdjuntoSchema | None = None


class UpdateMensajeDirectoSchema(BaseModel):
    contenido: str = Field(min_length=1, max_length=2000)


class ApodoSchema(BaseModel):
    # null o "" = sacar el apodo
    apodo: str | None = Field(default=None, max_length=32)
