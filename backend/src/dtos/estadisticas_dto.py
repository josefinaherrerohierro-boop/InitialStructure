from datetime import datetime

from pydantic import BaseModel


class TopUsuarioDTO(BaseModel):
    usuario_id: int
    username: str
    cantidad_mensajes: int


class CanalInactivoDTO(BaseModel):
    canal_id: int
    nombre: str
    ultimo_mensaje: datetime | None  # None = nunca tuvo mensajes


class CantidadPorMesDTO(BaseModel):
    mes: str  # formato "AAAA-MM", ej: "2026-11"
    cantidad: int


class CrecimientoDTO(BaseModel):
    total_miembros_actuales: int  # sin contar baneados
    miembros_por_mes: list[CantidadPorMesDTO]
    mensajes_por_mes: list[CantidadPorMesDTO]
