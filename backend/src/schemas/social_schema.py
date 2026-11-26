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
    # Puede quedar vacío si el mensaje tiene un adjunto (lo controla el service).
    contenido: str = Field(default="", max_length=2000)


class MiFotoSchema(BaseModel):
    # null = volver a usar la foto principal en este servidor
    foto_id: int | None = Field(default=None, gt=0)


class CarpetaSchema(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9]{1,12}$")
    nombre: str = Field(min_length=1, max_length=30)
    # Claves de lo que hay adentro, en orden: ["canal:6", "calendario", ...]
    items: list[str] = Field(default_factory=list, max_length=200)


class MiOrdenSchema(BaseModel):
    # Claves de las pestañas en el orden elegido, ej: ["canal:5", "resumen", "carpeta:a1"].
    # Lista vacía (y sin carpetas) = volver al orden por defecto.
    orden: list[str] = Field(max_length=200)
    # Carpetas personales: agrupan canales, salas o herramientas. Solo las ve quien las creó.
    carpetas: list[CarpetaSchema] = Field(default_factory=list, max_length=20)


class ApodoSchema(BaseModel):
    # null o "" = sacar el apodo
    apodo: str | None = Field(default=None, max_length=32)
