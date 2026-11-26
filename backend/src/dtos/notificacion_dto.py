from datetime import datetime

from pydantic import BaseModel

from src.dtos.social_dto import UsuarioResumenDTO


class NotificacionDTO(BaseModel):
    id: int
    tipo: str  # mencion | mensaje_directo | solicitud_amistad | amistad_aceptada | tarea_asignada
    texto: str
    actor: UsuarioResumenDTO | None  # quién la generó
    servidor_id: int | None
    canal_id: int | None
    mensaje_id: int | None
    leida: bool
    fecha: datetime


class NotificacionesDTO(BaseModel):
    no_leidas: int
    items: list[NotificacionDTO]
