from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.servidor_dto import (
    CreateServidorDTO,
    ServidorResponseDTO,
    TransferirServidorDTO,
    UpdateServidorDTO,
)
from src.middlewares.auth_middleware import get_current_user
from src.schemas.servidor_schema import (
    CreateServidorSchema,
    TransferirServidorSchema,
    UpdateServidorSchema,
)
from src.services.servidor_service import ServidorService

router = APIRouter(prefix="/servidores", tags=["servidores"])


# HU2 — Crear servidor. El dueño es quien está conectado (sale del token).
@router.post("/", response_model=ServidorResponseDTO, status_code=status.HTTP_201_CREATED)
def crear_servidor(
    payload: CreateServidorSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    dto = CreateServidorDTO(**payload.model_dump())
    return ServidorService(db).create(dto, actual.id)


@router.get("/{servidor_id}", response_model=ServidorResponseDTO)
def obtener_servidor(
    servidor_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return ServidorService(db).get(servidor_id, actual.id)


@router.patch("/{servidor_id}", response_model=ServidorResponseDTO)
def modificar_servidor(
    servidor_id: int,
    payload: UpdateServidorSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    dto = UpdateServidorDTO(**payload.model_dump())
    return ServidorService(db).update(servidor_id, dto, actual.id)


@router.delete("/{servidor_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_servidor(
    servidor_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    ServidorService(db).delete(servidor_id, actual.id)


# HU10 — Transferir el servidor a otro miembro (solo el dueño).
@router.post("/{servidor_id}/transferir", response_model=ServidorResponseDTO)
def transferir_servidor(
    servidor_id: int,
    payload: TransferirServidorSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    dto = TransferirServidorDTO(**payload.model_dump())
    return ServidorService(db).transferir(servidor_id, dto, actual.id)
