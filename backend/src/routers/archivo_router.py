from fastapi import APIRouter, Depends, File, UploadFile, status

from src.db.models.usuario_model import Usuario
from src.dtos.archivo_dto import ArchivoResponseDTO
from src.middlewares.auth_middleware import get_current_user
from src.services.archivo_service import ArchivoService
from src.utils.archivos import TAMANIO_MAXIMO

router = APIRouter(tags=["archivos"])


# Subir un archivo (imagen, audio, video...). Devuelve la URL para usarla
# después en un mensaje, una foto de perfil, una publicación o un estado.
# Se manda como multipart/form-data con el campo "archivo".
@router.post("/archivos", response_model=ArchivoResponseDTO, status_code=status.HTTP_201_CREATED)
async def subir_archivo(
    archivo: UploadFile = File(...),
    _: Usuario = Depends(get_current_user),
):
    # Leemos un byte más del máximo: si llega a leerlo, el archivo es muy grande.
    contenido = await archivo.read(TAMANIO_MAXIMO + 1)
    return ArchivoService().subir(contenido, archivo.filename or "archivo", archivo.content_type)
