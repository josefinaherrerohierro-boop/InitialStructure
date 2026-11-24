from pydantic import BaseModel

from src.dtos.social_dto import UsuarioResumenDTO


class CantidadConNombreDTO(BaseModel):
    nombre: str
    cantidad: int


class CanalFavoritoDTO(BaseModel):
    canal: str
    servidor: str
    cantidad: int


class PersonaFavoritaDTO(BaseModel):
    usuario: UsuarioResumenDTO
    cantidad: int


class PersonalidadDTO(BaseModel):
    titulo: str
    descripcion: str
    emoji: str


class WrappedDTO(BaseModel):
    """Kort Wrapped: el resumen del año de un usuario."""

    anio: int
    username: str
    total_mensajes: int
    total_palabras: int
    total_mensajes_directos: int
    dias_activos: int
    racha_mas_larga: int
    mensajes_por_mes: list[int]  # 12 valores, de enero a diciembre
    mes_mas_activo: str | None
    hora_pico: int | None
    dia_favorito: str | None
    canal_favorito: CanalFavoritoDTO | None
    servidores_mas_activos: list[CantidadConNombreDTO]
    emojis_favoritos: list[CantidadConNombreDTO]
    reacciones_recibidas: int
    persona_favorita: PersonaFavoritaDTO | None
    amigos_nuevos: int
    servidores_nuevos: int
    publicaciones: int
    likes_recibidos: int
    tareas_completadas: int
    eventos_asistidos: int
    puntos_ganados: int
    personalidad: PersonalidadDTO
