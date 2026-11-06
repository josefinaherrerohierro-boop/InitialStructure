from pydantic import BaseModel, Field


class CreateServidorSchema(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)


class UpdateServidorSchema(BaseModel):
    nombre: str | None = Field(default=None, min_length=2, max_length=100)


class TransferirServidorSchema(BaseModel):
    # HU10: id del miembro que pasa a ser el nuevo dueño.
    nuevo_duenio_id: int = Field(gt=0)
