from pydantic import BaseModel, Field


class CreateServidorSchema(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    # Servidor temporal: se borra solo después de estas horas (máximo 30 días).
    # Si no se manda, el servidor es permanente.
    duracion_horas: int | None = Field(default=None, ge=1, le=720)


class UpdateServidorSchema(BaseModel):
    nombre: str | None = Field(default=None, min_length=2, max_length=100)
    # Para servidores temporales: nueva duración contando desde ahora,
    # o hacer_permanente = true para que no se borre nunca.
    duracion_horas: int | None = Field(default=None, ge=1, le=720)
    hacer_permanente: bool = False


class OrdenServidoresSchema(BaseModel):
    # Ids de mis servidores en el orden en que los quiero ver.
    servidor_ids: list[int] = Field(max_length=500)


class TransferirServidorSchema(BaseModel):
    # HU10: id del miembro que pasa a ser el nuevo dueño.
    nuevo_duenio_id: int = Field(gt=0)
