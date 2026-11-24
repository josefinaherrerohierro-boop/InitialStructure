from datetime import datetime

from pydantic import BaseModel

from src.dtos.archivo_dto import AdjuntoDTO


class CreateMensajeDTO(BaseModel):
    contenido: str = ""
    adjunto: AdjuntoDTO | None = None


class UpdateMensajeDTO(BaseModel):
    contenido: str


class ReaccionResumenDTO(BaseModel):
    """Un emoji de un mensaje: cuántos lo pusieron y quiénes."""

    emoji: str
    cantidad: int
    usuarios: list[int]


class OpcionEncuestaDTO(BaseModel):
    id: int
    texto: str
    votos: int


class EncuestaDTO(BaseModel):
    id: int
    multiple: bool
    fecha_limite: datetime | None
    cerrada: bool
    total_votantes: int
    opciones: list[OpcionEncuestaDTO]
    mis_votos: list[int]  # ids de las opciones que votó quien consulta


class MensajeResponseDTO(BaseModel):
    id: int
    canal_id: int
    autor_id: int
    autor_username: str
    autor_apodo: str | None = None
    autor_avatar_url: str | None = None
    contenido: str
    fecha: datetime
    editado: bool
    fijado: bool = False
    adjunto: AdjuntoDTO | None = None
    reacciones: list[ReaccionResumenDTO] = []
    encuesta: EncuestaDTO | None = None


class CreateEncuestaDTO(BaseModel):
    pregunta: str
    opciones: list[str]
    multiple: bool = False
    fecha_limite: datetime | None = None


class VotarDTO(BaseModel):
    opcion_ids: list[int]
