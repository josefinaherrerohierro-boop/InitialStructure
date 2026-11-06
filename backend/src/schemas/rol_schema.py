from pydantic import BaseModel, Field


class CreateRolSchema(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    puede_escribir: bool = False
    puede_moderar: bool = False
    puede_invitar: bool = False


class UpdateRolSchema(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=50)
    puede_escribir: bool | None = None
    puede_moderar: bool | None = None
    puede_invitar: bool | None = None
