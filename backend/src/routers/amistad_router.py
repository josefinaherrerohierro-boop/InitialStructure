from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.social_dto import AmigoDTO, SolicitudesDTO
from src.middlewares.auth_middleware import get_current_user
from src.schemas.social_schema import SolicitudAmistadSchema
from src.services.amistad_service import AmistadService

router = APIRouter(prefix="/amigos", tags=["amigos"])


@router.get("", response_model=list[AmigoDTO])
def mis_amigos(db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return AmistadService(db).amigos(actual.id)


@router.get("/solicitudes", response_model=SolicitudesDTO)
def mis_solicitudes(db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return AmistadService(db).solicitudes(actual.id)


# Mandar solicitud por nombre de usuario. Si esa persona ya me había mandado
# una, quedan como amigos directamente. Responde {"estado": "enviada" | "amigos"}.
@router.post("/solicitudes", status_code=status.HTTP_201_CREATED)
def enviar_solicitud(
    payload: SolicitudAmistadSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
) -> dict:
    return {"estado": AmistadService(db).enviar(payload.username, actual.id)}


@router.post("/solicitudes/{solicitud_id}/aceptar", status_code=status.HTTP_204_NO_CONTENT)
def aceptar_solicitud(solicitud_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    AmistadService(db).aceptar(solicitud_id, actual.id)


# Rechazar una solicitud recibida o cancelar una enviada.
@router.delete("/solicitudes/{solicitud_id}", status_code=status.HTTP_204_NO_CONTENT)
def rechazar_solicitud(solicitud_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    AmistadService(db).rechazar(solicitud_id, actual.id)


@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_amigo(usuario_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    AmistadService(db).eliminar(usuario_id, actual.id)
