from datetime import datetime

from pydantic import BaseModel, Field


class CreateInvitacionSchema(BaseModel):
    # HU5: usos_maximos mayor a 0 (el límite de 1000 evita valores absurdos).
    usos_maximos: int = Field(gt=0, le=1000)
    # HU5: debe ser una fecha futura (se valida en el service).
    # Ejemplo: "2026-12-31T23:59:00"
    fecha_vencimiento: datetime
