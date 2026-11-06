from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.estadisticas_dto import CanalInactivoDTO, CrecimientoDTO, TopUsuarioDTO
from src.middlewares.auth_middleware import get_current_user
from src.services.estadisticas_service import EstadisticasService

router = APIRouter(prefix="/servidores", tags=["estadisticas"])


# HU11 — Los 10 miembros con más mensajes en los últimos 30 días.
@router.get("/{servidor_id}/top-usuarios", response_model=list[TopUsuarioDTO])
def top_usuarios(
    servidor_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return EstadisticasService(db).top_usuarios(servidor_id, actual.id)


# HU11 — Canales de texto sin mensajes en los últimos 30 días.
@router.get("/{servidor_id}/canales-inactivos", response_model=list[CanalInactivoDTO])
def canales_inactivos(
    servidor_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return EstadisticasService(db).canales_inactivos(servidor_id, actual.id)


# HU12 — Miembros que se unieron por mes, total actual y mensajes por mes.
@router.get("/{servidor_id}/crecimiento", response_model=CrecimientoDTO)
def crecimiento(
    servidor_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return EstadisticasService(db).crecimiento(servidor_id, actual.id)
