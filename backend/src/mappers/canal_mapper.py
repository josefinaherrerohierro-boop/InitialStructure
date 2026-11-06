from src.db.models.canal_model import Canal
from src.dtos.canal_dto import CanalResponseDTO


def to_canal_response(canal: Canal) -> CanalResponseDTO:
    return CanalResponseDTO.model_validate(canal)
