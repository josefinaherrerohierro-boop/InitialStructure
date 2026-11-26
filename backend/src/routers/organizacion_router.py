from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.organizacion_dto import (
    DarPuntosDTO,
    EventoDatosDTO,
    EventoDTO,
    MovimientoPuntosDTO,
    PuntajeDTO,
    TareaDatosDTO,
    TareaDTO,
)
from src.middlewares.auth_middleware import get_current_user
from src.schemas.organizacion_schema import (
    CreateEventoSchema,
    CreateTareaSchema,
    DarPuntosSchema,
    UpdateEventoSchema,
    UpdateTareaSchema,
)
from src.services.organizacion_service import CalendarioService, ScoreboardService, TareaService

router = APIRouter(tags=["calendario, tareas y scoreboard"])


# ---------- Calendario ----------
# ?desde=...&hasta=... (por defecto: desde hace un mes hasta dentro de 3 meses)
@router.get("/servidores/{servidor_id}/eventos", response_model=list[EventoDTO])
def listar_eventos(
    servidor_id: int,
    desde: datetime | None = Query(default=None),
    hasta: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return CalendarioService(db).listar(servidor_id, actual.id, desde, hasta)


@router.post("/servidores/{servidor_id}/eventos", response_model=EventoDTO, status_code=status.HTTP_201_CREATED)
def crear_evento(
    servidor_id: int,
    payload: CreateEventoSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return CalendarioService(db).crear(servidor_id, EventoDatosDTO(**payload.model_dump()), actual.id)


@router.patch("/eventos/{evento_id}", response_model=EventoDTO)
def editar_evento(
    evento_id: int,
    payload: UpdateEventoSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    dto = EventoDatosDTO(**payload.model_dump(), campos_enviados=set(payload.model_fields_set))
    return CalendarioService(db).editar(evento_id, dto, actual.id)


@router.delete("/eventos/{evento_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_evento(evento_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    CalendarioService(db).borrar(evento_id, actual.id)


# Anotarme / borrarme de un evento.
@router.post("/eventos/{evento_id}/asistir", response_model=EventoDTO)
def asistir(evento_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return CalendarioService(db).alternar_asistencia(evento_id, actual.id)


# ---------- Tareas ----------
@router.get("/servidores/{servidor_id}/tareas", response_model=list[TareaDTO])
def listar_tareas(
    servidor_id: int,
    mias: bool = Query(default=False),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return TareaService(db).listar(servidor_id, actual.id, solo_mias=mias)


@router.post("/servidores/{servidor_id}/tareas", response_model=TareaDTO, status_code=status.HTTP_201_CREATED)
def crear_tarea(
    servidor_id: int,
    payload: CreateTareaSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return TareaService(db).crear(servidor_id, TareaDatosDTO(**payload.model_dump()), actual.id)


@router.patch("/tareas/{tarea_id}", response_model=TareaDTO)
def editar_tarea(
    tarea_id: int,
    payload: UpdateTareaSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    dto = TareaDatosDTO(**payload.model_dump(), campos_enviados=set(payload.model_fields_set))
    return TareaService(db).editar(tarea_id, dto, actual.id)


@router.delete("/tareas/{tarea_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_tarea(tarea_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    TareaService(db).borrar(tarea_id, actual.id)


# ---------- Scoreboard ----------
@router.get("/servidores/{servidor_id}/scoreboard", response_model=list[PuntajeDTO])
def scoreboard(servidor_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return ScoreboardService(db).tabla(servidor_id, actual.id)


@router.get("/servidores/{servidor_id}/puntos", response_model=list[MovimientoPuntosDTO])
def movimientos_de_puntos(servidor_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return ScoreboardService(db).movimientos(servidor_id, actual.id)


# Dar (o quitar, con cantidad negativa) puntos a un miembro. Solo moderadores.
@router.post("/servidores/{servidor_id}/puntos", response_model=list[PuntajeDTO], status_code=status.HTTP_201_CREATED)
def dar_puntos(
    servidor_id: int,
    payload: DarPuntosSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return ScoreboardService(db).dar(servidor_id, DarPuntosDTO(**payload.model_dump()), actual.id)
