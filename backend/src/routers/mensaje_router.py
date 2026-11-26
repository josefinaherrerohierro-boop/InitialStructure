from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.archivo_dto import AdjuntoDTO
from src.dtos.mensaje_dto import (
    CreateEncuestaDTO,
    CreateMensajeDTO,
    MensajeResponseDTO,
    UpdateMensajeDTO,
    VotarDTO,
)
from src.middlewares.auth_middleware import get_current_user
from src.schemas.mensaje_schema import (
    CreateEncuestaSchema,
    CreateMensajeSchema,
    ReaccionSchema,
    UpdateMensajeSchema,
    VotarSchema,
)
from src.services.mensaje_service import MensajeService

router = APIRouter(tags=["mensajes"])


# HU7 — Enviar un mensaje a un canal de texto (texto, adjunto, o ambos).
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
    adjunto = AdjuntoDTO(**payload.adjunto.model_dump()) if payload.adjunto else None
    dto = CreateMensajeDTO(contenido=payload.contenido, adjunto=adjunto)
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


# Reaccionar con un emoji. Si ya estaba, se saca (alternar).
@router.post("/mensajes/{mensaje_id}/reacciones", response_model=MensajeResponseDTO)
def reaccionar(
    mensaje_id: int,
    payload: ReaccionSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return MensajeService(db).reaccionar(mensaje_id, payload.emoji, actual.id)


# Fijar / desfijar un mensaje (dueño o moderador).
@router.post("/mensajes/{mensaje_id}/fijar", response_model=MensajeResponseDTO)
def fijar_mensaje(
    mensaje_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return MensajeService(db).fijar(mensaje_id, True, actual.id)


@router.delete("/mensajes/{mensaje_id}/fijar", response_model=MensajeResponseDTO)
def desfijar_mensaje(
    mensaje_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return MensajeService(db).fijar(mensaje_id, False, actual.id)


@router.get("/canales/{canal_id}/fijados", response_model=list[MensajeResponseDTO])
def mensajes_fijados(
    canal_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return MensajeService(db).fijados(canal_id, actual.id)


# Buscar mensajes en un servidor: ?q=texto&canal_id=&autor_id=
@router.get("/servidores/{servidor_id}/buscar", response_model=list[MensajeResponseDTO])
def buscar_mensajes(
    servidor_id: int,
    q: str = Query(min_length=1, max_length=100),
    canal_id: int | None = Query(default=None, ge=1),
    autor_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return MensajeService(db).buscar(servidor_id, q, actual.id, canal_id=canal_id, autor_id=autor_id)


# Sección de multimedia: ?tipo=imagen|video|audio|archivo|link&antes_de=
@router.get("/servidores/{servidor_id}/multimedia", response_model=list[MensajeResponseDTO])
def multimedia(
    servidor_id: int,
    tipo: str = Query(default="imagen"),
    antes_de: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return MensajeService(db).multimedia(servidor_id, tipo, actual.id, antes_de=antes_de)


# Encuestas: se crean en un canal (aparecen como un mensaje) y se votan.
@router.post(
    "/canales/{canal_id}/encuestas",
    response_model=MensajeResponseDTO,
    status_code=status.HTTP_201_CREATED,
)
def crear_encuesta(
    canal_id: int,
    payload: CreateEncuestaSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    dto = CreateEncuestaDTO(**payload.model_dump())
    return MensajeService(db).crear_encuesta(canal_id, dto, actual.id)


@router.post("/encuestas/{encuesta_id}/votar", response_model=MensajeResponseDTO)
def votar_encuesta(
    encuesta_id: int,
    payload: VotarSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    dto = VotarDTO(**payload.model_dump())
    return MensajeService(db).votar(encuesta_id, dto, actual.id)
