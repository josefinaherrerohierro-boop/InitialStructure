from src.db.models.mensaje_directo_model import MensajeDirecto
from src.db.models.usuario_model import Usuario
from src.dtos.social_dto import MensajeDirectoResponseDTO, UsuarioResumenDTO
from src.mappers.mensaje_mapper import to_adjunto


def to_usuario_resumen(usuario: Usuario) -> UsuarioResumenDTO:
    return UsuarioResumenDTO.model_validate(usuario)


def to_mensaje_directo_response(mensaje: MensajeDirecto, autor: Usuario) -> MensajeDirectoResponseDTO:
    return MensajeDirectoResponseDTO(
        id=mensaje.id,
        autor_id=mensaje.remitente_id,
        destinatario_id=mensaje.destinatario_id,
        autor_username=autor.username,
        autor_avatar_url=autor.avatar_url,
        contenido=mensaje.contenido,
        fecha=mensaje.fecha,
        editado=mensaje.editado,
        leido=mensaje.leido,
        adjunto=to_adjunto(mensaje.adjunto_url, mensaje.adjunto_tipo, mensaje.adjunto_nombre),
    )
