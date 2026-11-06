from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.usuario_dto import CreateUsuarioDTO, UpdateUsuarioDTO, UsuarioResponseDTO
from src.middlewares.auth_middleware import get_current_user
from src.schemas.usuario_schema import CreateUsuarioSchema, UpdateUsuarioSchema
from src.services.usuario_service import UsuarioService

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


# HU1 — Registro. Es el único endpoint de usuarios que NO pide token.
@router.post("/", response_model=UsuarioResponseDTO, status_code=status.HTTP_201_CREATED)
def registrar_usuario(payload: CreateUsuarioSchema, db: Session = Depends(get_db)):
    dto = CreateUsuarioDTO(**payload.model_dump())
    return UsuarioService(db).create(dto)


@router.get("/", response_model=list[UsuarioResponseDTO])
def listar_usuarios(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    return UsuarioService(db).list_all()


# Las rutas /me van antes que /{usuario_id} para que "me" no se tome como un id.
@router.patch("/me", response_model=UsuarioResponseDTO)
def modificar_mi_cuenta(
    payload: UpdateUsuarioSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    # El id sale del token: nadie puede modificar la cuenta de otra persona.
    dto = UpdateUsuarioDTO(**payload.model_dump())
    return UsuarioService(db).update(actual.id, dto)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def borrar_mi_cuenta(
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    UsuarioService(db).delete(actual.id)


@router.get("/{usuario_id}", response_model=UsuarioResponseDTO)
def obtener_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    return UsuarioService(db).get_by_id(usuario_id)
