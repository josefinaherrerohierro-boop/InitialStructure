from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.publicacion_dto import (
    ComentarioDTO,
    CreateEstadoDTO,
    CreatePublicacionDTO,
    EstadoDTO,
    EstadosDeUsuarioDTO,
    PublicacionDTO,
)
from src.middlewares.auth_middleware import get_current_user
from src.schemas.publicacion_schema import ComentarioSchema, CreateEstadoSchema, CreatePublicacionSchema
from src.services.publicacion_service import PublicacionService

router = APIRouter(tags=["publicaciones y estados"])


# ---------- Publicaciones ----------
# Feed: publicaciones de perfil mías y de mis amigos (paginado con ?antes_de=id).
@router.get("/publicaciones/feed", response_model=list[PublicacionDTO])
def feed(
    antes_de: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return PublicacionService(db).feed(actual.id, antes_de)


@router.get("/perfiles/{usuario_id}/publicaciones", response_model=list[PublicacionDTO])
def publicaciones_de_perfil(
    usuario_id: int,
    antes_de: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return PublicacionService(db).de_perfil(usuario_id, actual.id, antes_de)


@router.get("/servidores/{servidor_id}/publicaciones", response_model=list[PublicacionDTO])
def publicaciones_de_servidor(
    servidor_id: int,
    antes_de: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return PublicacionService(db).de_servidor(servidor_id, actual.id, antes_de)


# Sin servidor_id se publica en el perfil; con servidor_id, dentro de ese servidor.
@router.post("/publicaciones", response_model=PublicacionDTO, status_code=status.HTTP_201_CREATED)
def crear_publicacion(
    payload: CreatePublicacionSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return PublicacionService(db).crear(CreatePublicacionDTO(**payload.model_dump()), actual.id)


@router.delete("/publicaciones/{publicacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_publicacion(publicacion_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    PublicacionService(db).borrar(publicacion_id, actual.id)


@router.post("/publicaciones/{publicacion_id}/like", response_model=PublicacionDTO)
def me_gusta(publicacion_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return PublicacionService(db).alternar_like(publicacion_id, actual.id)


@router.get("/publicaciones/{publicacion_id}/comentarios", response_model=list[ComentarioDTO])
def comentarios(publicacion_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return PublicacionService(db).comentarios(publicacion_id, actual.id)


@router.post(
    "/publicaciones/{publicacion_id}/comentarios",
    response_model=ComentarioDTO,
    status_code=status.HTTP_201_CREATED,
)
def comentar(
    publicacion_id: int,
    payload: ComentarioSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return PublicacionService(db).comentar(publicacion_id, payload.contenido, actual.id)


@router.delete("/comentarios/{comentario_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_comentario(comentario_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    PublicacionService(db).borrar_comentario(comentario_id, actual.id)


# ---------- Estados (24 horas) ----------
@router.get("/estados", response_model=list[EstadosDeUsuarioDTO])
def estados(db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return PublicacionService(db).estados(actual.id)


@router.post("/estados", response_model=EstadoDTO, status_code=status.HTTP_201_CREATED)
def subir_estado(payload: CreateEstadoSchema, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return PublicacionService(db).crear_estado(CreateEstadoDTO(**payload.model_dump()), actual.id)


@router.delete("/estados/{estado_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_estado(estado_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    PublicacionService(db).borrar_estado(estado_id, actual.id)
