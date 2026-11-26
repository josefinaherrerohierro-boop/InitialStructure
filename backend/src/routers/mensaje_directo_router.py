from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.archivo_dto import AdjuntoDTO
from src.dtos.social_dto import ConversacionDTO, CreateMensajeDirectoDTO, MensajeDirectoResponseDTO
from src.middlewares.auth_middleware import get_current_user
from src.schemas.social_schema import CreateMensajeDirectoSchema, FijadosSchema, UpdateMensajeDirectoSchema
from src.services.mensaje_directo_service import MensajeDirectoService

router = APIRouter(prefix="/mensajes-directos", tags=["mensajes directos"])


# Mis conversaciones (la más reciente primero) con la cantidad de no leídos.
@router.get("", response_model=list[ConversacionDTO])
def mis_conversaciones(db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return MensajeDirectoService(db).conversaciones(actual.id)


# Fijar conversaciones arriba (y elegir su orden). Reemplaza la lista entera.
@router.put("/fijados", response_model=list[ConversacionDTO])
def fijar_conversaciones(
    payload: FijadosSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return MensajeDirectoService(db).fijar(payload.usuario_ids, actual.id)


# Mensajes con un usuario (paginados igual que los canales). Los marca como leídos.
@router.get("/{usuario_id}", response_model=list[MensajeDirectoResponseDTO])
def conversacion(
    usuario_id: int,
    limite: int = Query(default=50, ge=1, le=100),
    antes_de: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return MensajeDirectoService(db).listar(usuario_id, actual.id, limite=limite, antes_de=antes_de)


@router.post("/{usuario_id}", response_model=MensajeDirectoResponseDTO, status_code=status.HTTP_201_CREATED)
def enviar_mensaje_directo(
    usuario_id: int,
    payload: CreateMensajeDirectoSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    adjunto = AdjuntoDTO(**payload.adjunto.model_dump()) if payload.adjunto else None
    dto = CreateMensajeDirectoDTO(contenido=payload.contenido, adjunto=adjunto)
    return MensajeDirectoService(db).enviar(usuario_id, dto, actual.id)


@router.patch("/mensaje/{mensaje_id}", response_model=MensajeDirectoResponseDTO)
def editar_mensaje_directo(
    mensaje_id: int,
    payload: UpdateMensajeDirectoSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return MensajeDirectoService(db).editar(mensaje_id, payload.contenido, actual.id)


@router.delete("/mensaje/{mensaje_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_mensaje_directo(mensaje_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    MensajeDirectoService(db).borrar(mensaje_id, actual.id)
