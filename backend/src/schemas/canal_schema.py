from typing import Literal

from pydantic import BaseModel, Field


class CreateCanalSchema(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    tipo: Literal["texto", "voz"]  # cualquier otro valor → 422
    solo_lectura: bool = False


class UpdateCanalSchema(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    solo_lectura: bool | None = None
