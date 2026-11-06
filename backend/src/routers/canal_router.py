from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.canal_dto import CanalResponseDTO, CreateCanalDTO, UpdateCanalDTO
from src.middlewares.auth_middleware import get_current_user
from src.schemas.canal_schema import CreateCanalSchema, UpdateCanalSchema
from src.services.canal_service import CanalService

# Sin prefix: usa rutas /servidores/{id}/canales y /canales/{id}.
router = APIRouter(tags=["canales"])


# HU3 — Crear canal (dueño o moderador).
@router.post(
    "/servidores/{servidor_id}/canales",
    response_model=CanalResponseDTO,
    status_code=status.HTTP_201_CREATED,
)
def crear_canal(
    servidor_id: int,
    payload: CreateCanalSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    dto = CreateCanalDTO(**payload.model_dump())
    return CanalService(db).create(servidor_id, dto, actual.id)


# HU3 — Listar canales del servidor (cualquier miembro).
@router.get("/servidores/{servidor_id}/canales", response_model=list[CanalResponseDTO])
def listar_canales(
    servidor_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return CanalService(db).list_by_servidor(servidor_id, actual.id)


@router.patch("/canales/{canal_id}", response_model=CanalResponseDTO)
def modificar_canal(
    canal_id: int,
    payload: UpdateCanalSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    dto = UpdateCanalDTO(**payload.model_dump())
    return CanalService(db).update(canal_id, dto, actual.id)


@router.delete("/canales/{canal_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_canal(
    canal_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    CanalService(db).delete(canal_id, actual.id)
