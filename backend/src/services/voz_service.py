"""
Llamadas: voz, video, compartir pantalla, pizarra y juegos (WebRTC).

Cómo funciona, en pocas palabras:
- El AUDIO y el VIDEO (cámara y pantalla compartida) viajan directamente
  entre los navegadores (WebRTC, "peer to peer"). Nuestro servidor nunca
  recibe ni procesa el sonido ni la imagen.
- Para conectarse, los navegadores primero tienen que intercambiar unos datos
  técnicos (oferta, respuesta y "candidatos ICE"). Eso se llama SEÑALIZACIÓN,
  y la hace este módulo: recibe esos mensajes por WebSocket y se los reenvía
  al destinatario.
- La PIZARRA y los JUEGOS también usan ese WebSocket: el servidor guarda el
  dibujo y el estado del juego, y se los manda a todos los de la llamada.
- Quién está en cada canal de voz, la pizarra y el juego se guardan EN
  MEMORIA (no en la base de datos): duran mientras haya alguien conectado.
"""

import asyncio
import logging
from dataclasses import dataclass, field

from fastapi import WebSocket
from sqlalchemy.orm import Session

from src.db.connection import SessionLocal
from src.db.models.canal_model import Canal
from src.db.models.usuario_model import Usuario
from src.dtos.voz_dto import ParticipanteVozDTO
from src.repositories.canal_repository import CanalRepository
from src.repositories.usuario_repository import UsuarioRepository
from src.services.juegos_service import NOMBRES, PUNTOS_POR_GANAR, Juego, JugadaInvalida, crear_juego
from src.services.organizacion_service import ScoreboardService
from src.services.permisos_service import PermisosService
from src.utils.errors import NotFoundError, UnauthorizedError, UnprocessableError
from src.utils.jwt import decode_token

log = logging.getLogger("kort")

MAXIMO_TRAZOS = 3000  # trazos guardados por pizarra
MAXIMO_PUNTOS_POR_TRAZO = 1000


@dataclass
class Participante:
    usuario_id: int
    username: str
    websocket: WebSocket
    silenciado: bool = False
    camara: bool = False
    pantalla: bool = False

    def resumen(self) -> dict:
        return {
            "usuario_id": self.usuario_id,
            "username": self.username,
            "silenciado": self.silenciado,
            "camara": self.camara,
            "pantalla": self.pantalla,
        }


@dataclass
class Sala:
    servidor_id: int
    participantes: dict[int, Participante] = field(default_factory=dict)
    trazos: list[dict] = field(default_factory=list)  # la pizarra
    juego: Juego | None = None


def _trazo_valido(trazo) -> dict | None:
    """Un trazo es una línea: lista de puntos (x, y entre 0 y 1), color y grosor."""
    if not isinstance(trazo, dict):
        return None
    puntos = trazo.get("puntos")
    color = trazo.get("color")
    grosor = trazo.get("grosor")
    if not isinstance(puntos, list) or not 1 <= len(puntos) <= MAXIMO_PUNTOS_POR_TRAZO:
        return None
    limpios = []
    for p in puntos:
        if not (isinstance(p, list) and len(p) == 2 and all(isinstance(v, (int, float)) for v in p)):
            return None
        limpios.append([min(max(float(p[0]), 0.0), 1.0), min(max(float(p[1]), 0.0), 1.0)])
    if not (isinstance(color, str) and len(color) == 7 and color.startswith("#")):
        return None
    if not isinstance(grosor, (int, float)) or not 1 <= grosor <= 40:
        return None
    return {"puntos": limpios, "color": color, "grosor": grosor, "borrador": bool(trazo.get("borrador"))}


def _otorgar_puntos(servidor_id: int, usuario_id: int, cantidad: int, motivo: str) -> None:
    """Se corre en otro hilo: abre su propia sesión de base de datos."""
    db = SessionLocal()
    try:
        ScoreboardService(db).sumar_automatico(servidor_id, usuario_id, cantidad, motivo)
    finally:
        db.close()


class SalasDeVoz:
    """Guarda quién está en cada canal de voz, su pizarra y su juego, y
    reenvía los mensajes de señalización.

    Estructura: { canal_id: Sala }
    """

    def __init__(self):
        self.salas: dict[int, Sala] = {}

    def participantes(self, canal_id: int) -> list[Participante]:
        sala = self.salas.get(canal_id)
        return list(sala.participantes.values()) if sala else []

    async def entrar(self, canal_id: int, servidor_id: int, nuevo: Participante) -> None:
        sala = self.salas.setdefault(canal_id, Sala(servidor_id=servidor_id))

        # Si la misma persona ya estaba conectada (por ejemplo, desde otra
        # pestaña), cerramos la conexión vieja y nos quedamos con la nueva.
        anterior = sala.participantes.get(nuevo.usuario_id)
        if anterior is not None:
            await self._enviar(anterior, {"tipo": "error", "mensaje": "Entraste a este canal desde otra pestaña."})
            try:
                await anterior.websocket.close(code=4000)
            except Exception:
                pass

        otros = [p.resumen() for p in sala.participantes.values() if p.usuario_id != nuevo.usuario_id]
        sala.participantes[nuevo.usuario_id] = nuevo

        # Al que entra le contamos quiénes ya estaban (él les va a mandar una
        # "oferta" a cada uno), cómo está la pizarra y si hay un juego.
        await self._enviar(
            nuevo,
            {
                "tipo": "bienvenida",
                "yo": nuevo.usuario_id,
                "participantes": otros,
                "pizarra": sala.trazos,
                "juego": sala.juego.publico() if sala.juego else None,
            },
        )
        await self._difundir(canal_id, {"tipo": "entro", "participante": nuevo.resumen()}, excepto=nuevo.usuario_id)

    async def salir(self, canal_id: int, participante: Participante) -> None:
        sala = self.salas.get(canal_id)
        # Solo lo sacamos si sigue siendo ESA conexión (no una más nueva).
        if not sala or sala.participantes.get(participante.usuario_id) is not participante:
            return
        del sala.participantes[participante.usuario_id]
        if not sala.participantes:
            # Se fue el último: se borran la pizarra y el juego.
            del self.salas[canal_id]
            return
        await self._difundir(canal_id, {"tipo": "salio", "usuario_id": participante.usuario_id})
        # Si estaba jugando, el juego se cancela.
        if sala.juego and sala.juego.estado != "terminado" and participante.usuario_id in sala.juego.jugadores:
            sala.juego = None
            await self._difundir(canal_id, {"tipo": "juego", "juego": None, "aviso": f"{participante.username} salió: se canceló el juego"})

    async def reenviar_senal(self, canal_id: int, de: int, para: int, datos: dict) -> None:
        """Pasa un mensaje de señalización (oferta, respuesta o candidato ICE)
        de un participante a otro. El servidor no lo lee: solo lo reenvía."""
        sala = self.salas.get(canal_id)
        destino = sala.participantes.get(para) if sala else None
        if destino is not None:
            await self._enviar(destino, {"tipo": "senal", "de": de, "datos": datos})

    async def cambiar_estado(self, canal_id: int, usuario_id: int, cambios: dict) -> None:
        """Micrófono silenciado, cámara prendida o pantalla compartida."""
        sala = self.salas.get(canal_id)
        participante = sala.participantes.get(usuario_id) if sala else None
        if participante is None:
            return
        for campo in ("silenciado", "camara", "pantalla"):
            if campo in cambios:
                setattr(participante, campo, bool(cambios[campo]))
        await self._difundir(canal_id, {"tipo": "estado", **participante.resumen()}, excepto=usuario_id)

    # ---------- Pizarra ----------
    async def pizarra(self, canal_id: int, usuario_id: int, mensaje: dict) -> None:
        sala = self.salas.get(canal_id)
        if not sala or usuario_id not in sala.participantes:
            return
        accion = mensaje.get("accion")
        if accion == "trazo":
            trazo = _trazo_valido(mensaje.get("trazo"))
            if trazo is None:
                return
            sala.trazos.append(trazo)
            del sala.trazos[:-MAXIMO_TRAZOS]  # nos quedamos con los últimos
            await self._difundir(canal_id, {"tipo": "pizarra", "accion": "trazo", "trazo": trazo}, excepto=usuario_id)
        elif accion == "limpiar":
            sala.trazos.clear()
            await self._difundir(canal_id, {"tipo": "pizarra", "accion": "limpiar", "por": usuario_id})

    # ---------- Juegos ----------
    async def juego(self, canal_id: int, participante: Participante, mensaje: dict) -> None:
        sala = self.salas.get(canal_id)
        if not sala or participante.usuario_id not in sala.participantes:
            return
        accion = mensaje.get("accion")
        uid = participante.usuario_id
        try:
            if accion == "crear":
                if sala.juego and sala.juego.estado != "terminado":
                    raise JugadaInvalida("Ya hay un juego en curso en esta llamada")
                sala.juego = crear_juego(str(mensaje.get("juego")), uid, participante.username)
            elif accion == "cancelar":
                if not sala.juego:
                    return
                if sala.juego.estado != "terminado" and uid not in sala.juego.jugadores:
                    raise JugadaInvalida("Solo los que juegan pueden cancelar el juego")
                sala.juego = None
            elif sala.juego is None:
                raise JugadaInvalida("No hay ningún juego en curso")
            elif accion == "unirse":
                sala.juego.unirse(uid, participante.username)
            elif accion == "jugar":
                sala.juego.jugar(uid, mensaje)
            else:
                return
        except JugadaInvalida as error:
            await self._enviar(participante, {"tipo": "juego_error", "mensaje": str(error)})
            return

        juego = sala.juego
        await self._difundir(canal_id, {"tipo": "juego", "juego": juego.publico() if juego else None})

        # ¿Terminó con un ganador? Le sumamos puntos en el scoreboard del servidor.
        if juego and accion == "jugar" and juego.estado == "terminado" and juego.ganador is not None:
            puntos = PUNTOS_POR_GANAR[juego.tipo]
            try:
                await asyncio.to_thread(
                    _otorgar_puntos, sala.servidor_id, juego.ganador, puntos, f"Ganó {NOMBRES[juego.tipo]} en una llamada"
                )
            except Exception:
                log.exception("No se pudieron sumar los puntos del juego")

    # ---------- Envío de mensajes ----------
    async def _difundir(self, canal_id: int, mensaje: dict, excepto: int | None = None) -> None:
        for p in self.participantes(canal_id):
            if p.usuario_id != excepto:
                await self._enviar(p, mensaje)

    @staticmethod
    async def _enviar(participante: Participante, mensaje: dict) -> None:
        try:
            await participante.websocket.send_json(mensaje)
        except Exception:
            # Si esa conexión ya se cortó, se va a limpiar sola al salir.
            pass


# Una sola instancia para toda la aplicación.
salas_de_voz = SalasDeVoz()


class VozService:
    """Validaciones para entrar a un canal de voz (usa las mismas reglas de permisos)."""

    def __init__(self, db: Session):
        self.canales = CanalRepository(db)
        self.usuarios = UsuarioRepository(db)
        self.permisos = PermisosService(db)

    def autenticar(self, token: str) -> Usuario:
        """Los WebSockets del navegador no pueden mandar el header Authorization,
        así que el token viaja como parámetro (?token=...)."""
        if not token:
            raise UnauthorizedError("Falta el token. Iniciá sesión primero.")
        payload = decode_token(token)
        usuario = self.usuarios.find_by_id(int(payload.get("sub", 0)))
        if usuario is None:
            raise UnauthorizedError("El usuario del token ya no existe")
        return usuario

    def validar_ingreso(self, canal_id: int, usuario_id: int) -> Canal:
        canal = self.canales.find_by_id(canal_id)
        if canal is None:
            raise NotFoundError("Canal no encontrado")
        if canal.tipo != "voz":
            raise UnprocessableError("Ese canal no es de voz")
        # Solo miembros no baneados del servidor del canal.
        self.permisos.exigir_miembro(canal.servidor_id, usuario_id)
        return canal

    def participantes(self, canal_id: int, actual_id: int) -> list[ParticipanteVozDTO]:
        self.validar_ingreso(canal_id, actual_id)
        return [ParticipanteVozDTO(**p.resumen()) for p in salas_de_voz.participantes(canal_id)]
