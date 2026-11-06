from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.invitacion_dto import CreateInvitacionDTO, InvitacionResponseDTO
from src.dtos.servidor_dto import ServidorResponseDTO
from src.middlewares.auth_middleware import get_current_user
from src.schemas.invitacion_schema import CreateInvitacionSchema
from src.services.invitacion_service import InvitacionService

router = APIRouter(tags=["invitaciones"])


# HU5 — Crear invitación (dueño o rol con puede_invitar). El código es automático.
@router.post(
    "/servidores/{servidor_id}/invitaciones",
    response_model=InvitacionResponseDTO,
    status_code=status.HTTP_201_CREATED,
)
def crear_invitacion(
    servidor_id: int,
    payload: CreateInvitacionSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    dto = CreateInvitacionDTO(**payload.model_dump())
    return InvitacionService(db).create(servidor_id, dto, actual.id)


@router.get("/servidores/{servidor_id}/invitaciones", response_model=list[InvitacionResponseDTO])
def listar_invitaciones(
    servidor_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return InvitacionService(db).list_by_servidor(servidor_id, actual.id)


# HU6 — Unirse a un servidor con un código. Devuelve el servidor al que entró.
@router.post("/invitaciones/{codigo}/usar", response_model=ServidorResponseDTO)
def usar_invitacion(
    codigo: str,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return InvitacionService(db).usar(codigo, actual.id)


@router.delete("/invitaciones/{codigo}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_invitacion(
    codigo: str,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    InvitacionService(db).delete(codigo, actual.id)
