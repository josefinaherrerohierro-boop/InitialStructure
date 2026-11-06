from datetime import datetime

from pydantic import BaseModel


class CreateInvitacionDTO(BaseModel):
    usos_maximos: int
    fecha_vencimiento: datetime


class InvitacionResponseDTO(BaseModel):
    id: int
    servidor_id: int
    creador_id: int
    codigo: str
    usos_maximos: int
    usos: int
    fecha_vencimiento: datetime

    model_config = {"from_attributes": True}
