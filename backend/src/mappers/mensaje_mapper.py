from src.db.models.mensaje_model import Mensaje
from src.db.models.usuario_model import Usuario
from src.dtos.archivo_dto import AdjuntoDTO
from src.dtos.mensaje_dto import EncuestaDTO, MensajeResponseDTO, ReaccionResumenDTO


def to_adjunto(url: str | None, tipo: str | None, nombre: str | None) -> AdjuntoDTO | None:
    if not url or not tipo:
        return None
    return AdjuntoDTO(url=url, tipo=tipo, nombre=nombre)


def to_mensaje_response(
    mensaje: Mensaje,
    autor: Usuario,
    apodo: str | None = None,
    avatar_url: str | None = None,
    reacciones: list[ReaccionResumenDTO] | None = None,
    encuesta: EncuestaDTO | None = None,
) -> MensajeResponseDTO:
    return MensajeResponseDTO(
        id=mensaje.id,
        canal_id=mensaje.canal_id,
        autor_id=mensaje.autor_id,
        autor_username=autor.username,
        autor_apodo=apodo,
        autor_avatar_url=avatar_url or autor.avatar_url,
        contenido=mensaje.contenido,
        fecha=mensaje.fecha,
        editado=mensaje.editado,
        fijado=bool(mensaje.fijado),
        adjunto=to_adjunto(mensaje.adjunto_url, mensaje.adjunto_tipo, mensaje.adjunto_nombre),
        reacciones=reacciones or [],
        encuesta=encuesta,
    )
