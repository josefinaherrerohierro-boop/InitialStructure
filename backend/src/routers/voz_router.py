from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from src.config.env import settings
from src.db.connection import SessionLocal, get_db
from src.db.models.usuario_model import Usuario
from src.dtos.voz_dto import ParticipanteVozDTO
from src.middlewares.auth_middleware import get_current_user
from src.services.voz_service import Participante, VozService, salas_de_voz
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
#   {"tipo": "estado", "silenciado": true|false}               micrófono silenciado o no
# Mensajes que manda el servidor:
#   bienvenida, entro, salio, senal, estado, error
@router.websocket("/ws/voz/{canal_id}")
async def canal_de_voz(websocket: WebSocket, canal_id: int, token: str = Query(default="")):
    await websocket.accept()

    # CORS no se aplica a los WebSockets: revisamos a mano que venga de nuestro frontend.
    origen = websocket.headers.get("origin")
    if origen and origen != settings.FRONTEND_URL:
        await websocket.send_json({"tipo": "error", "mensaje": "Origen no permitido"})
        await websocket.close(code=4403)
        return

    # Validaciones con una sesión de base de datos corta (se cierra enseguida:
    # la conexión de voz puede durar mucho y no hace falta tener la base abierta).
    db = SessionLocal()
    try:
        servicio = VozService(db)
        usuario = servicio.autenticar(token)
        servicio.validar_ingreso(canal_id, usuario.id)
        participante = Participante(usuario_id=usuario.id, username=usuario.username, websocket=websocket)
    except AppError as error:
        await websocket.send_json({"tipo": "error", "mensaje": error.message})
        await websocket.close(code=4000 + error.status_code % 1000)  # ej: 401 → 4401
        return
    finally:
        db.close()

    await salas_de_voz.entrar(canal_id, participante)
    try:
        while True:
            mensaje = await websocket.receive_json()
            tipo = mensaje.get("tipo")
            if tipo == "senal":
                try:
                    para = int(mensaje.get("para"))
                except (TypeError, ValueError):
                    continue
                await salas_de_voz.reenviar_senal(canal_id, participante.usuario_id, para, mensaje.get("datos"))
            elif tipo == "estado":
                await salas_de_voz.cambiar_silencio(canal_id, participante.usuario_id, bool(mensaje.get("silenciado")))
    except WebSocketDisconnect:
        pass
    except Exception:
        # Mensaje mal formado u otro corte inesperado: cerramos la sesión de voz.
        pass
    finally:
        await salas_de_voz.salir(canal_id, participante)
