from datetime import datetime

from pydantic import BaseModel

from src.dtos.social_dto import UsuarioResumenDTO


# ---------- Calendario ----------
class EventoDatosDTO(BaseModel):
    titulo: str | None = None
    descripcion: str | None = None
    lugar: str | None = None
    inicio: datetime | None = None
    fin: datetime | None = None


class EventoDTO(BaseModel):
    id: int
    servidor_id: int
    creador: UsuarioResumenDTO
    titulo: str
    descripcion: str
    lugar: str
    inicio: datetime
    fin: datetime | None
    asistentes: list[UsuarioResumenDTO]
    voy: bool


# ---------- Tareas ----------
class TareaDatosDTO(BaseModel):
    titulo: str | None = None
    descripcion: str | None = None
    asignado_id: int | None = None
    fecha_limite: datetime | None = None
    estado: str | None = None
    # Para distinguir "no lo mandó" de "lo mandó en null" (desasignar o sacar la fecha).
    campos_enviados: set[str] = set()


class TareaDTO(BaseModel):
    id: int
    servidor_id: int
    creador: UsuarioResumenDTO
    asignado: UsuarioResumenDTO | None
    titulo: str
    descripcion: str
    fecha_limite: datetime | None
    estado: str
    vencida: bool
    fecha_creacion: datetime
    fecha_completada: datetime | None


# ---------- Scoreboard ----------
class PuntajeDTO(BaseModel):
    posicion: int
    usuario: UsuarioResumenDTO
    apodo: str | None
    puntos: int
    mensajes_30_dias: int
    tareas_hechas: int


class MovimientoPuntosDTO(BaseModel):
    id: int
    usuario: UsuarioResumenDTO
    otorgado_por: UsuarioResumenDTO | None  # None = automático (juegos)
    cantidad: int
    motivo: str
    fecha: datetime


class DarPuntosDTO(BaseModel):
    usuario_id: int
    cantidad: int
    motivo: str = ""
