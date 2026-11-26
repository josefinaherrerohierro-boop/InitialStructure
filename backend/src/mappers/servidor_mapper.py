from src.db.models.servidor_model import Servidor
from src.dtos.servidor_dto import ServidorResponseDTO


def to_servidor_response(servidor: Servidor) -> ServidorResponseDTO:
    dto = ServidorResponseDTO.model_validate(servidor)
    dto.tiene_clave_borrado = servidor.clave_borrado_hash is not None
    return dto
