from datetime import datetime

from pydantic import BaseModel, Field


class CreateEventoSchema(BaseModel):
    titulo: str = Field(min_length=1, max_length=100)
    descripcion: str = Field(default="", max_length=1000)
    lugar: str = Field(default="", max_length=100)
    inicio: datetime
    fin: datetime | None = None


class UpdateEventoSchema(BaseModel):
    titulo: str | None = Field(default=None, min_length=1, max_length=100)
    descripcion: str | None = Field(default=None, max_length=1000)
    lugar: str | None = Field(default=None, max_length=100)
    inicio: datetime | None = None
    fin: datetime | None = None


class CreateTareaSchema(BaseModel):
    titulo: str = Field(min_length=1, max_length=120)
    descripcion: str = Field(default="", max_length=1000)
    asignado_id: int | None = Field(default=None, gt=0)
    fecha_limite: datetime | None = None


class UpdateTareaSchema(BaseModel):
    """Solo se cambia lo que se manda. asignado_id o fecha_limite en null = sacarlos."""

    titulo: str | None = Field(default=None, min_length=1, max_length=120)
    descripcion: str | None = Field(default=None, max_length=1000)
    asignado_id: int | None = Field(default=None, gt=0)
    fecha_limite: datetime | None = None
    estado: str | None = Field(default=None, pattern=r"^(pendiente|en_progreso|hecha)$")


class DarPuntosSchema(BaseModel):
    usuario_id: int = Field(gt=0)
    cantidad: int = Field(ge=-1000, le=1000)
    motivo: str = Field(default="", max_length=100)
