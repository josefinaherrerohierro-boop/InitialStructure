from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.perfil_dto import HistorialServidorDTO, PerfilDTO, RedSocialDTO, UpdatePerfilDTO
from src.dtos.wrapped_dto import WrappedDTO
from src.middlewares.auth_middleware import get_current_user
from src.schemas.perfil_schema import FotoPerfilSchema, UpdatePerfilSchema
from src.services.perfil_service import PerfilService
from src.services.wrapped_service import WrappedService

router = APIRouter(prefix="/perfiles", tags=["perfiles"])


# Las rutas /me van antes que /{usuario_id} para que "me" no se tome como un id.
@router.patch("/me", response_model=PerfilDTO)
def editar_mi_perfil(
    payload: UpdatePerfilSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    dto = UpdatePerfilDTO(
        bio=payload.bio,
        etiquetas=payload.etiquetas,
        redes=[RedSocialDTO(**r.model_dump()) for r in payload.redes] if payload.redes is not None else None,
    )
    return PerfilService(db).actualizar(dto, actual.id)


@router.post("/me/fotos", response_model=PerfilDTO, status_code=status.HTTP_201_CREATED)
def agregar_foto(payload: FotoPerfilSchema, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return PerfilService(db).agregar_foto(payload.url, actual.id)


@router.post("/me/fotos/{foto_id}/principal", response_model=PerfilDTO)
def elegir_foto_principal(foto_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return PerfilService(db).elegir_principal(foto_id, actual.id)


@router.delete("/me/fotos/{foto_id}", response_model=PerfilDTO)
def borrar_foto(foto_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return PerfilService(db).borrar_foto(foto_id, actual.id)


# Historial de servidores en los que estuve (es privado: solo el propio).
@router.get("/me/historial-servidores", response_model=list[HistorialServidorDTO])
def mi_historial_de_servidores(db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return PerfilService(db).historial_servidores(actual.id)


# Kort Wrapped: el resumen del año (por defecto, el año actual). Es privado.
@router.get("/me/wrapped", response_model=WrappedDTO)
def mi_wrapped(
    anio: int | None = Query(default=None, ge=2000),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return WrappedService(db).generar(actual.id, anio)


@router.get("/{usuario_id}", response_model=PerfilDTO)
def ver_perfil(usuario_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return PerfilService(db).perfil(usuario_id, actual.id)
