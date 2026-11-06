from src.db.models.miembro_model import Miembro
from src.db.models.rol_model import Rol
from src.db.models.usuario_model import Usuario
from src.dtos.miembro_dto import MiembroResponseDTO, RolResumenDTO


def to_miembro_response(
    miembro: Miembro, usuario: Usuario, roles: list[Rol], es_duenio: bool
) -> MiembroResponseDTO:
    return MiembroResponseDTO(
        usuario_id=usuario.id,
        username=usuario.username,
        fecha_union=miembro.fecha_union,
        es_duenio=es_duenio,
        roles=[RolResumenDTO.model_validate(r) for r in roles],
    )
