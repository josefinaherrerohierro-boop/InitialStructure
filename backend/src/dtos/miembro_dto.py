from datetime import datetime

from pydantic import BaseModel


class RolResumenDTO(BaseModel):
    id: int
    nombre: str

    model_config = {"from_attributes": True}


class MiembroResponseDTO(BaseModel):
    usuario_id: int
    username: str
    fecha_union: datetime
    es_duenio: bool
    roles: list[RolResumenDTO]
