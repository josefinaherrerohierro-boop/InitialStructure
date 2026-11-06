from src.db.models.mensaje_model import Mensaje
from src.db.models.usuario_model import Usuario
from src.dtos.mensaje_dto import MensajeResponseDTO


def to_mensaje_response(mensaje: Mensaje, autor: Usuario) -> MensajeResponseDTO:
    return MensajeResponseDTO(
        id=mensaje.id,
        canal_id=mensaje.canal_id,
        autor_id=mensaje.autor_id,
        autor_username=autor.username,
        contenido=mensaje.contenido,
        fecha=mensaje.fecha,
        editado=mensaje.editado,
    )
