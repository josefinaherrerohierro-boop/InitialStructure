from fastapi import APIRouter, Depends, status
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


# HU9 — Expulsar (moderador). Puede volver con otra invitación.
@router.post(
    "/servidores/{servidor_id}/miembros/{usuario_id}/expulsar",
    status_code=status.HTTP_204_NO_CONTENT,
)
def expulsar_miembro(
    servidor_id: int,
    usuario_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    MiembroService(db).expulsar(servidor_id, usuario_id, actual.id)


# HU9 — Banear (moderador). No puede volver a entrar.
@router.post(
    "/servidores/{servidor_id}/miembros/{usuario_id}/banear",
    status_code=status.HTTP_204_NO_CONTENT,
)
def banear_miembro(
    servidor_id: int,
    usuario_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    MiembroService(db).banear(servidor_id, usuario_id, actual.id)


# HU10 — Salir del servidor (el dueño primero tiene que transferirlo).
@router.post("/servidores/{servidor_id}/salir", status_code=status.HTTP_204_NO_CONTENT)
def salir_del_servidor(
    servidor_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    MiembroService(db).salir(servidor_id, actual.id)
