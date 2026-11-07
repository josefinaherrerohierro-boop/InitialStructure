"""
Chat de voz (WebRTC).

Cómo funciona, en pocas palabras:
- El AUDIO viaja directamente entre los navegadores (WebRTC, "peer to peer").
  Nuestro servidor nunca recibe ni procesa el sonido.
- Para conectarse, los navegadores primero tienen que intercambiar unos datos
  técnicos (oferta, respuesta y "candidatos ICE"). Eso se llama SEÑALIZACIÓN,
  y la hace este módulo: recibe esos mensajes por WebSocket y se los reenvía
  al destinatario.
- Quién está en cada canal de voz se guarda EN MEMORIA (no en la base de
  datos): es información que solo dura mientras la conexión está abierta.
"""

from dataclasses import dataclass

from fastapi import WebSocket
from sqlalchemy.orm import Session

from src.db.models.canal_model import Canal
from src.db.models.usuario_model import Usuario
from src.dtos.voz_dto import ParticipanteVozDTO
from src.repositories.canal_repository import CanalRepository
from src.repositories.usuario_repository import UsuarioRepository
from src.services.permisos_service import PermisosService
from src.utils.errors import NotFoundError, UnauthorizedError, UnprocessableError
from src.utils.jwt import decode_token


@dataclass
class Participante:
    usuario_id: int
    username: str
    websocket: WebSocket
    silenciado: bool = False

    def resumen(self) -> dict:
        return {"usuario_id": self.usuario_id, "username": self.username, "silenciado": self.silenciado}


class SalasDeVoz:
    """Guarda quién está en cada canal de voz y reenvía los mensajes de señalización.

    Estructura: { canal_id: { usuario_id: Participante } }
    """

    def __init__(self):
        self.salas: dict[int, dict[int, Participante]] = {}

    def participantes(self, canal_id: int) -> list[Participante]:
        return list(self.salas.get(canal_id, {}).values())

    async def entrar(self, canal_id: int, nuevo: Participante) -> None:
        sala = self.salas.setdefault(canal_id, {})

        # Si la misma persona ya estaba conectada (por ejemplo, desde otra
        # pestaña), cerramos la conexión vieja y nos quedamos con la nueva.
        anterior = sala.get(nuevo.usuario_id)
        if anterior is not None:
            await self._enviar(anterior, {"tipo": "error", "mensaje": "Entraste a este canal desde otra pestaña."})
            try:
                await anterior.websocket.close(code=4000)
            except Exception:
                pass

        otros = [p.resumen() for p in sala.values() if p.usuario_id != nuevo.usuario_id]
        sala[nuevo.usuario_id] = nuevo

        # Al que entra le contamos quiénes ya estaban (él les va a mandar una
        # "oferta" a cada uno). A los demás les avisamos que entró alguien.
        await self._enviar(nuevo, {"tipo": "bienvenida", "yo": nuevo.usuario_id, "participantes": otros})
        await self._difundir(canal_id, {"tipo": "entro", "participante": nuevo.resumen()}, excepto=nuevo.usuario_id)

    async def salir(self, canal_id: int, participante: Participante) -> None:
        sala = self.salas.get(canal_id)
        # Solo lo sacamos si sigue siendo ESA conexión (no una más nueva).
        if not sala or sala.get(participante.usuario_id) is not participante:
            return
        del sala[participante.usuario_id]
        if not sala:
            del self.salas[canal_id]
        await self._difundir(canal_id, {"tipo": "salio", "usuario_id": participante.usuario_id})

    async def reenviar_senal(self, canal_id: int, de: int, para: int, datos: dict) -> None:
        """Pasa un mensaje de señalización (oferta, respuesta o candidato ICE)
        de un participante a otro. El servidor no lo lee: solo lo reenvía."""
        destino = self.salas.get(canal_id, {}).get(para)
        if destino is not None:
            await self._enviar(destino, {"tipo": "senal", "de": de, "datos": datos})

    async def cambiar_silencio(self, canal_id: int, usuario_id: int, silenciado: bool) -> None:
        participante = self.salas.get(canal_id, {}).get(usuario_id)
        if participante is None:
            return
        participante.silenciado = silenciado
        await self._difundir(
            canal_id, {"tipo": "estado", "usuario_id": usuario_id, "silenciado": silenciado}, excepto=usuario_id
        )

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
