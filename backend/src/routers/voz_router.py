from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from src.config.env import origen_permitido
from src.db.connection import SessionLocal, get_db
from src.db.models.usuario_model import Usuario
from src.dtos.voz_dto import ParticipanteVozDTO
from src.middlewares.auth_middleware import get_current_user
from src.services.voz_service import Participante, VozService, clave_directo, salas_de_voz
from src.utils.errors import AppError

router = APIRouter(tags=["voz"])


# Quién está conectado ahora a un canal de voz (para mostrarlo en la barra lateral).
@router.get("/canales/{canal_id}/voz", response_model=list[ParticipanteVozDTO])
def participantes_de_voz(
    canal_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return VozService(db).participantes(canal_id, actual.id)


# Conexión en tiempo real para la SEÑALIZACIÓN de WebRTC.
# URL: ws://localhost:8000/api/ws/voz/{canal_id}?token=...
#
# Mensajes que manda el navegador:
#   {"tipo": "senal", "para": <usuario_id>, "datos": {...}}   oferta / respuesta / candidato ICE
#   {"tipo": "estado", "silenciado": bool, "camara": bool, "pantalla": bool}
#   {"tipo": "pizarra", "accion": "trazo", "trazo": {...}}, {"accion": "deshacer"} o {"accion": "limpiar"}
#     (un trazo puede ser lápiz, línea, flecha, rectángulo, elipse, texto o imagen)
#   {"tipo": "juego", "accion": "crear" | "unirse" | "jugar" | "cancelar", ...}
# Mensajes que manda el servidor:
#   bienvenida, entro, salio, senal, estado, pizarra, juego, juego_error, error
# Llamadas en mensajes directos: quién está en la llamada con esa persona.
@router.get("/mensajes-directos/{otro_id}/llamada", response_model=list[ParticipanteVozDTO])
def participantes_llamada_directa(
    otro_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    return VozService(db).participantes_directo(otro_id, actual.id)


# Quién me está llamando ahora por mensaje directo (el frontend lo consulta cada pocos segundos).
@router.get("/llamadas/entrantes", response_model=list[ParticipanteVozDTO])
def llamadas_entrantes(actual: Usuario = Depends(get_current_user)):
    return VozService.llamadas_entrantes(actual.id)


async def _origen_permitido(websocket: WebSocket) -> bool:
    # CORS no se aplica a los WebSockets: revisamos a mano que venga de nuestro frontend.
    if not origen_permitido(websocket.headers.get("origin")):
        await websocket.send_json({"tipo": "error", "mensaje": "Origen no permitido"})
        await websocket.close(code=4403)
        return False
    return True


async def _atender(websocket: WebSocket, clave: int | str, servidor_id: int | None, participante: Participante) -> None:
    """Recibe los mensajes de una persona en una llamada hasta que se va."""
    await salas_de_voz.entrar(clave, servidor_id, participante)
    try:
        while True:
            mensaje = await websocket.receive_json()
            tipo = mensaje.get("tipo")
            if tipo == "senal":
                try:
                    para = int(mensaje.get("para"))
                except (TypeError, ValueError):
                    continue
                await salas_de_voz.reenviar_senal(clave, participante.usuario_id, para, mensaje.get("datos"))
            elif tipo == "estado":
                await salas_de_voz.cambiar_estado(clave, participante.usuario_id, mensaje)
            elif tipo == "pizarra":
                await salas_de_voz.pizarra(clave, participante.usuario_id, mensaje)
            elif tipo == "juego":
                await salas_de_voz.juego(clave, participante, mensaje)
    except WebSocketDisconnect:
        pass
    except Exception:
        # Mensaje mal formado u otro corte inesperado: cerramos la sesión de voz.
        pass
    finally:
        await salas_de_voz.salir(clave, participante)


@router.websocket("/ws/voz/{canal_id}")
async def canal_de_voz(websocket: WebSocket, canal_id: int, token: str = Query(default="")):
    await websocket.accept()
    if not await _origen_permitido(websocket):
        return

    # Validaciones con una sesión de base de datos corta (se cierra enseguida:
    # la conexión de voz puede durar mucho y no hace falta tener la base abierta).
    db = SessionLocal()
    try:
        servicio = VozService(db)
        usuario = servicio.autenticar(token)
        canal = servicio.validar_ingreso(canal_id, usuario.id)
        servidor_id = canal.servidor_id
        participante = Participante(usuario_id=usuario.id, username=usuario.username, websocket=websocket)
    except AppError as error:
        await websocket.send_json({"tipo": "error", "mensaje": error.message})
        await websocket.close(code=4000 + error.status_code % 1000)  # ej: 401 → 4401
        return
    finally:
        db.close()

    await _atender(websocket, canal_id, servidor_id, participante)


# Llamada por mensaje directo con otra persona (misma mecánica que un canal de voz).
@router.websocket("/ws/voz-directo/{otro_id}")
async def llamada_directa(websocket: WebSocket, otro_id: int, token: str = Query(default="")):
    await websocket.accept()
    if not await _origen_permitido(websocket):
        return
    db = SessionLocal()
    try:
        servicio = VozService(db)
        usuario = servicio.autenticar(token)
        servicio.validar_directo(otro_id, usuario.id)
        participante = Participante(usuario_id=usuario.id, username=usuario.username, websocket=websocket)
    except AppError as error:
        await websocket.send_json({"tipo": "error", "mensaje": error.message})
        await websocket.close(code=4000 + error.status_code % 1000)
        return
    finally:
        db.close()

    await _atender(websocket, clave_directo(usuario.id, otro_id), None, participante)
