from src.db.models.rol_model import Rol
from src.dtos.rol_dto import RolResponseDTO


def to_rol_response(rol: Rol) -> RolResponseDTO:
    return RolResponseDTO.model_validate(rol)
