from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.notificacion_dto import NotificacionesDTO
from src.middlewares.auth_middleware import get_current_user
from src.schemas.notificacion_schema import LeerNotificacionesSchema
from src.services.notificacion_service import NotificacionService

router = APIRouter(prefix="/notificaciones", tags=["notificaciones"])


# Mis avisos más recientes y cuántos tengo sin leer (el frontend lo consulta cada pocos segundos).
@router.get("", response_model=NotificacionesDTO)
def mis_notificaciones(db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return NotificacionService(db).listar(actual.id)


# Marcar como leídas: las indicadas en "ids", o todas si no se manda nada.
@router.post("/leer", response_model=NotificacionesDTO)
def leer_notificaciones(
    payload: LeerNotificacionesSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return NotificacionService(db).leer(actual.id, payload.ids)
