from pydantic import BaseModel, Field

# HU7: el contenido no puede estar vacío ni superar los 2000 caracteres.
# (Que no sea solo espacios se controla en el service.)


class CreateMensajeSchema(BaseModel):
    contenido: str = Field(min_length=1, max_length=2000)


class UpdateMensajeSchema(BaseModel):
    contenido: str = Field(min_length=1, max_length=2000)
