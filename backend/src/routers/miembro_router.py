from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.miembro_dto import MiembroResponseDTO
from src.middlewares.auth_middleware import get_current_user
from src.services.miembro_service import MiembroService

router = APIRouter(tags=["miembros"])


# Lista de miembros (no baneados) con sus roles. La ve cualquier miembro.
@router.get("/servidores/{servidor_id}/miembros", response_model=list[MiembroResponseDTO])
def listar_miembros(
    servidor_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return MiembroService(db).list_by_servidor(servidor_id, actual.id)
