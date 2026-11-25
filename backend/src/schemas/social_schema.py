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


class MiFotoSchema(BaseModel):
    # null = volver a usar la foto principal en este servidor
    foto_id: int | None = Field(default=None, gt=0)


class MiOrdenSchema(BaseModel):
    # Claves de las pestañas en el orden elegido, ej: ["canal:5", "resumen", "calendario"].
    # Lista vacía = volver al orden por defecto.
    orden: list[str] = Field(max_length=200)


class ApodoSchema(BaseModel):
    # null o "" = sacar el apodo
    apodo: str | None = Field(default=None, max_length=32)
