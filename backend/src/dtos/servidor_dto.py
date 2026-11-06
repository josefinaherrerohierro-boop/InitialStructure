from datetime import datetime

from pydantic import BaseModel


class CreateServidorDTO(BaseModel):
    nombre: str


class UpdateServidorDTO(BaseModel):
    nombre: str | None = None


class ServidorResponseDTO(BaseModel):
    id: int
    nombre: str
    duenio_id: int
    fecha_creacion: datetime

    model_config = {"from_attributes": True}


class TransferirServidorDTO(BaseModel):
    nuevo_duenio_id: int
