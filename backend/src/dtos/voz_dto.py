from pydantic import BaseModel


class ParticipanteVozDTO(BaseModel):
    """Alguien conectado ahora mismo a un canal de voz."""

    usuario_id: int
    username: str
    silenciado: bool
