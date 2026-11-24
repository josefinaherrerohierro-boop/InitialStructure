from datetime import datetime

from pydantic import BaseModel, Field

# HU7: el contenido no puede superar los 2000 caracteres. Puede estar vacío
# solo si el mensaje lleva un adjunto (eso se controla en el service).


class AdjuntoSchema(BaseModel):
    url: str = Field(max_length=255)
    tipo: str = Field(pattern=r"^(imagen|audio|video|archivo)$")
    nombre: str | None = Field(default=None, max_length=255)


class CreateMensajeSchema(BaseModel):
    contenido: str = Field(default="", max_length=2000)
    adjunto: AdjuntoSchema | None = None


class UpdateMensajeSchema(BaseModel):
    contenido: str = Field(min_length=1, max_length=2000)


class ReaccionSchema(BaseModel):
    emoji: str = Field(min_length=1, max_length=32)


class CreateEncuestaSchema(BaseModel):
    pregunta: str = Field(min_length=1, max_length=300)
    opciones: list[str] = Field(min_length=2, max_length=10)
    multiple: bool = False
    fecha_limite: datetime | None = None  # sin fecha límite si no se manda


class VotarSchema(BaseModel):
    # Lista vacía = sacar mi voto.
    opcion_ids: list[int] = Field(max_length=10)
