from datetime import datetime

from pydantic import BaseModel


class RolResumenDTO(BaseModel):
    id: int
    nombre: str

    model_config = {"from_attributes": True}


class CarpetaDTO(BaseModel):
    id: str
    nombre: str
    items: list[str]


class MiMembresiaDTO(BaseModel):
    """Lo que cada uno configura para sí mismo en un servidor."""

    apodo: str | None
    foto_id: int | None  # None = usa la foto principal
    orden_secciones: list[str] | None  # None = orden por defecto
    carpetas: list[CarpetaDTO] = []  # carpetas personales


class MiembroResponseDTO(BaseModel):
    usuario_id: int
    username: str
    apodo: str | None = None
    avatar_url: str | None = None
    fecha_union: datetime
    es_duenio: bool
    roles: list[RolResumenDTO]


class BaneadoDTO(BaseModel):
    """Alguien baneado de un servidor (para la lista de baneados)."""

    usuario_id: int
    username: str
    avatar_url: str | None = None
    fecha_baneo: datetime | None = None  # None si se baneó antes de que existiera el historial
