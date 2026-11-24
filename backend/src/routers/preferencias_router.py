from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.preferencias_dto import PreferenciasDTO
from src.middlewares.auth_middleware import get_current_user
from src.schemas.preferencias_schema import PreferenciasSchema
from src.services.preferencias_service import PreferenciasService

router = APIRouter(prefix="/preferencias", tags=["apariencia"])


@router.get("", response_model=PreferenciasDTO)
def mis_preferencias(db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return PreferenciasService(db).obtener(actual.id)


@router.put("", response_model=PreferenciasDTO)
def guardar_preferencias(
    payload: PreferenciasSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return PreferenciasService(db).guardar(actual.id, PreferenciasDTO(**payload.model_dump()))
