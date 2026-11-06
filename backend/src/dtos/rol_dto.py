from pydantic import BaseModel


class CreateRolDTO(BaseModel):
    nombre: str
    puede_escribir: bool = False
    puede_moderar: bool = False
    puede_invitar: bool = False


class UpdateRolDTO(BaseModel):
    nombre: str | None = None
    puede_escribir: bool | None = None
    puede_moderar: bool | None = None
    puede_invitar: bool | None = None


class RolResponseDTO(BaseModel):
    id: int
    servidor_id: int
    nombre: str
    puede_escribir: bool
    puede_moderar: bool
    puede_invitar: bool

    model_config = {"from_attributes": True}
