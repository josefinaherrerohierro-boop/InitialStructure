from pydantic import BaseModel


class CreateCanalDTO(BaseModel):
    nombre: str
    tipo: str
    solo_lectura: bool = False


class UpdateCanalDTO(BaseModel):
    nombre: str | None = None
    solo_lectura: bool | None = None


class CanalResponseDTO(BaseModel):
    id: int
    servidor_id: int
    nombre: str
    tipo: str
    solo_lectura: bool

    model_config = {"from_attributes": True}
