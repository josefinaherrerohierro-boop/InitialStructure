from src.db.models.servidor_model import Servidor
from src.dtos.servidor_dto import ServidorResponseDTO


def to_servidor_response(servidor: Servidor) -> ServidorResponseDTO:
    return ServidorResponseDTO.model_validate(servidor)
