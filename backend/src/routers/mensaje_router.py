from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.mensaje_dto import CreateMensajeDTO, MensajeResponseDTO, UpdateMensajeDTO
from src.middlewares.auth_middleware import get_current_user
from src.schemas.mensaje_schema import CreateMensajeSchema, UpdateMensajeSchema
from src.services.mensaje_service import MensajeService

router = APIRouter(tags=["mensajes"])


# HU7 — Enviar un mensaje a un canal de texto.
@router.post(
    "/canales/{canal_id}/mensajes",
    response_model=MensajeResponseDTO,
    status_code=status.HTTP_201_CREATED,
)
def enviar_mensaje(
    canal_id: int,
    payload: CreateMensajeSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    dto = CreateMensajeDTO(**payload.model_dump())
    return MensajeService(db).enviar(canal_id, dto, actual.id)


# HU8 — Listar mensajes paginados: ?limite=50&antes_de={id}
@router.get("/canales/{canal_id}/mensajes", response_model=list[MensajeResponseDTO])
def listar_mensajes(
    canal_id: int,
    limite: int = Query(default=50, ge=1, le=100),
    antes_de: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return MensajeService(db).listar(canal_id, actual.id, limite=limite, antes_de=antes_de)


# HU8 — Editar (solo el autor). Marca editado = true.
@router.patch("/mensajes/{mensaje_id}", response_model=MensajeResponseDTO)
def editar_mensaje(
    mensaje_id: int,
    payload: UpdateMensajeSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    dto = UpdateMensajeDTO(**payload.model_dump())
    return MensajeService(db).editar(mensaje_id, dto, actual.id)


# HU8 — Borrar (el autor o un moderador).
@router.delete("/mensajes/{mensaje_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_mensaje(
    mensaje_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    MensajeService(db).borrar(mensaje_id, actual.id)
