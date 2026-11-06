from datetime import datetime

from pydantic import BaseModel


class CreateMensajeDTO(BaseModel):
    contenido: str


class UpdateMensajeDTO(BaseModel):
    contenido: str


class MensajeResponseDTO(BaseModel):
    id: int
    canal_id: int
    autor_id: int
    autor_username: str
    contenido: str
    fecha: datetime
    editado: bool
