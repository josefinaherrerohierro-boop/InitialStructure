from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.rol_dto import CreateRolDTO, RolResponseDTO, UpdateRolDTO
from src.middlewares.auth_middleware import get_current_user
from src.schemas.rol_schema import CreateRolSchema, UpdateRolSchema
from src.services.rol_service import RolService

router = APIRouter(tags=["roles"])


# HU4 — Crear rol (solo el dueño).
@router.post(
    "/servidores/{servidor_id}/roles",
    response_model=RolResponseDTO,
    status_code=status.HTTP_201_CREATED,
)
def crear_rol(
    servidor_id: int,
    payload: CreateRolSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    dto = CreateRolDTO(**payload.model_dump())
    return RolService(db).create(servidor_id, dto, actual.id)


@router.get("/servidores/{servidor_id}/roles", response_model=list[RolResponseDTO])
def listar_roles(
    servidor_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return RolService(db).list_by_servidor(servidor_id, actual.id)


@router.patch("/roles/{rol_id}", response_model=RolResponseDTO)
def modificar_rol(
    rol_id: int,
    payload: UpdateRolSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    dto = UpdateRolDTO(**payload.model_dump())
    return RolService(db).update(rol_id, dto, actual.id)


# HU4 — Borrar rol (no se puede borrar @everyone).
@router.delete("/roles/{rol_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_rol(
    rol_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    RolService(db).delete(rol_id, actual.id)


# HU4 — Asignar un rol a un miembro (solo el dueño).
@router.post(
    "/servidores/{servidor_id}/miembros/{usuario_id}/roles/{rol_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def asignar_rol(
    servidor_id: int,
    usuario_id: int,
    rol_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    RolService(db).asignar(servidor_id, usuario_id, rol_id, actual.id)


@router.delete(
    "/servidores/{servidor_id}/miembros/{usuario_id}/roles/{rol_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def quitar_rol(
    servidor_id: int,
    usuario_id: int,
    rol_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    RolService(db).quitar(servidor_id, usuario_id, rol_id, actual.id)
