from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from src.dtos.wrapped_dto import (
    CanalFavoritoDTO,
    CantidadConNombreDTO,
    PersonaFavoritaDTO,
    PersonalidadDTO,
    WrappedDTO,
)
from src.mappers.social_mapper import to_usuario_resumen
from src.repositories.usuario_repository import UsuarioRepository
from src.repositories.wrapped_repository import WrappedRepository
from src.utils.errors import NotFoundError, UnprocessableError
from src.utils.fechas import ahora

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def racha_mas_larga(dias: list) -> int:
    """Mayor cantidad de días seguidos con al menos un mensaje."""
    mejor = actual = 0
    anterior = None
    for d in dias:
        actual = actual + 1 if anterior is not None and d - anterior == timedelta(days=1) else 1
        mejor = max(mejor, actual)
        anterior = d
    return mejor


def personalidad(total: int, hora_pico: int | None, racha: int, reacciones: int, amigos: int) -> PersonalidadDTO:
    """Un título divertido según cómo usó Kort en el año."""
    if total == 0:
        return PersonalidadDTO(titulo="Observador silencioso", descripcion="Leíste todo, escribiste poco. Un misterio.", emoji="👀")
    if hora_pico is not None and (hora_pico >= 23 or hora_pico < 5):
        return PersonalidadDTO(titulo="Búho nocturno", descripcion="Tus mejores charlas pasan cuando todos duermen.", emoji="🦉")
    if hora_pico is not None and 5 <= hora_pico < 9:
        return PersonalidadDTO(titulo="Madrugador", descripcion="Llegás antes que nadie y con el mate listo.", emoji="🌅")
    if racha >= 14:
        return PersonalidadDTO(titulo="Constante", descripcion=f"{racha} días seguidos escribiendo. No fallás nunca.", emoji="🔥")
    if amigos >= 5:
        return PersonalidadDTO(titulo="Alma de la fiesta", descripcion="Sumaste amigos como nadie este año.", emoji="🎉")
    if reacciones >= 20:
        return PersonalidadDTO(titulo="Generador de reacciones", descripcion="Lo que escribís no pasa desapercibido.", emoji="💬")
    return PersonalidadDTO(titulo="Buena compañía", descripcion="Siempre presente cuando el grupo te necesita.", emoji="🤝")


class WrappedService:
    """Arma el Kort Wrapped del año (como el de Spotify, pero con tus chats)."""

    def __init__(self, db: Session):
        self.wrapped = WrappedRepository(db)
        self.usuarios = UsuarioRepository(db)

    def generar(self, usuario_id: int, anio: int | None = None) -> WrappedDTO:
        usuario = self.usuarios.find_by_id(usuario_id)
        if usuario is None:
            raise NotFoundError("Usuario no encontrado")
        anio = anio or ahora().year
        if not 2000 <= anio <= ahora().year:
            raise UnprocessableError("Ese año todavía no pasó")
        desde, hasta = datetime(anio, 1, 1), datetime(anio + 1, 1, 1)
        r = self.wrapped
        uid = usuario.id

        por_mes = r.por_mes(uid, desde, hasta)
        por_hora = r.por_hora(uid, desde, hasta)
        por_dia = r.por_dia_de_semana(uid, desde, hasta)
        dias = r.dias_con_mensajes(uid, desde, hasta)
        racha = racha_mas_larga(dias)
        total = r.total_mensajes(uid, desde, hasta)
        recibidas = r.reacciones_recibidas(uid, desde, hasta)
        amigos = r.amigos_nuevos(uid, desde, hasta)
        hora_pico = max(por_hora, key=por_hora.get) if por_hora else None

        canal = r.canal_favorito(uid, desde, hasta)
        persona = r.persona_mas_hablada(uid, desde, hasta)

        return WrappedDTO(
            anio=anio,
            username=usuario.username,
            total_mensajes=total,
            total_palabras=r.total_palabras(uid, desde, hasta),
            total_mensajes_directos=r.total_directos(uid, desde, hasta),
            dias_activos=len(dias),
            racha_mas_larga=racha,
            mensajes_por_mes=[por_mes.get(m, 0) for m in range(1, 13)],
            mes_mas_activo=MESES[max(por_mes, key=por_mes.get) - 1] if por_mes else None,
            hora_pico=hora_pico,
            dia_favorito=DIAS[max(por_dia, key=por_dia.get)] if por_dia else None,
            canal_favorito=CanalFavoritoDTO(canal=canal[0], servidor=canal[1], cantidad=canal[2]) if canal else None,
            servidores_mas_activos=[CantidadConNombreDTO(nombre=n, cantidad=c) for n, c in r.servidores_mas_activos(uid, desde, hasta)],
            emojis_favoritos=[CantidadConNombreDTO(nombre=e, cantidad=c) for e, c in r.emojis_favoritos(uid, desde, hasta)],
            reacciones_recibidas=recibidas,
            persona_favorita=(
                PersonaFavoritaDTO(usuario=to_usuario_resumen(persona[0]), cantidad=persona[1])
                if persona and persona[0]
                else None
            ),
            amigos_nuevos=amigos,
            servidores_nuevos=r.servidores_nuevos(uid, desde, hasta),
            publicaciones=r.publicaciones(uid, desde, hasta),
            likes_recibidos=r.likes_recibidos(uid, desde, hasta),
            tareas_completadas=r.tareas_completadas(uid, desde, hasta),
            eventos_asistidos=r.eventos_asistidos(uid, desde, hasta),
            puntos_ganados=r.puntos_ganados(uid, desde, hasta),
            personalidad=personalidad(total, hora_pico, racha, recibidas, amigos),
        )
