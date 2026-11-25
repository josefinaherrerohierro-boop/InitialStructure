from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.miembro_dto import CarpetaDTO, MiembroResponseDTO, MiMembresiaDTO
from src.middlewares.auth_middleware import get_current_user
from src.schemas.social_schema import ApodoSchema, MiFotoSchema, MiOrdenSchema
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


# Poner o sacar un apodo dentro del servidor (el propio, o el de otro si sos moderador).
@router.put("/servidores/{servidor_id}/miembros/{usuario_id}/apodo", response_model=MiembroResponseDTO)
def cambiar_apodo(
    servidor_id: int,
    usuario_id: int,
    payload: ApodoSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return MiembroService(db).cambiar_apodo(servidor_id, usuario_id, payload.apodo, actual.id)


# Lo que cada uno configura para sí mismo en un servidor (no afecta a los demás).
@router.get("/servidores/{servidor_id}/mi-membresia", response_model=MiMembresiaDTO)
def mi_membresia(servidor_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return MiembroService(db).mi_membresia(servidor_id, actual.id)


# Qué foto de perfil uso en este servidor (null = la principal).
@router.put("/servidores/{servidor_id}/mi-foto", response_model=MiMembresiaDTO)
def elegir_mi_foto(
    servidor_id: int,
    payload: MiFotoSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return MiembroService(db).elegir_foto(servidor_id, payload.foto_id, actual.id)


# Mi orden de las pestañas del servidor (canales, salas y herramientas) y mis carpetas.
@router.put("/servidores/{servidor_id}/mi-orden", response_model=MiMembresiaDTO)
def ordenar_mis_secciones(
    servidor_id: int,
    payload: MiOrdenSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    carpetas = [CarpetaDTO(**c.model_dump()) for c in payload.carpetas]
    return MiembroService(db).ordenar_secciones(servidor_id, payload.orden, actual.id, carpetas)
