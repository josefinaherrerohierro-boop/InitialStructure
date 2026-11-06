from src.db.models.invitacion_model import Invitacion
from src.dtos.invitacion_dto import InvitacionResponseDTO


def to_invitacion_response(invitacion: Invitacion) -> InvitacionResponseDTO:
    return InvitacionResponseDTO.model_validate(invitacion)
