from datetime import datetime

from pydantic import BaseModel


class CreateServidorDTO(BaseModel):
    nombre: str
    duracion_horas: int | None = None


class UpdateServidorDTO(BaseModel):
    nombre: str | None = None
    duracion_horas: int | None = None
    hacer_permanente: bool = False


class ServidorResponseDTO(BaseModel):
    id: int
    nombre: str
    duenio_id: int
    fecha_creacion: datetime
    expira_en: datetime | None = None  # None = permanente

    model_config = {"from_attributes": True}


class TransferirServidorDTO(BaseModel):
    nuevo_duenio_id: int
