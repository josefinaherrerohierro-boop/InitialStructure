from datetime import datetime

from pydantic import BaseModel


class RolResumenDTO(BaseModel):
    id: int
    nombre: str

    model_config = {"from_attributes": True}


class MiembroResponseDTO(BaseModel):
    usuario_id: int
    username: str
    apodo: str | None = None
    avatar_url: str | None = None
    fecha_union: datetime
    es_duenio: bool
    roles: list[RolResumenDTO]
