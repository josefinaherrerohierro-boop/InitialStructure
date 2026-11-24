import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.config.env import settings
from src.db.connection import SessionLocal
from src.middlewares.error_middleware import app_error_handler
from src.routers import (
    amistad_router,
    archivo_router,
    auth_router,
    canal_router,
    estadisticas_router,
    invitacion_router,
    mensaje_directo_router,
    mensaje_router,
    miembro_router,
    organizacion_router,
    perfil_router,
    publicacion_router,
    rol_router,
    servidor_router,
    usuario_router,
    voz_router,
)
from src.services.limpieza_service import limpiar_vencidos
from src.utils.archivos import CARPETA_UPLOADS
from src.utils.errors import AppError

log = logging.getLogger("kort")


async def _limpieza_periodica():
    """Cada minuto borra los servidores temporales y los estados vencidos."""
    while True:
        try:
            await asyncio.to_thread(limpiar_vencidos, SessionLocal)
        except Exception:
            log.exception("Falló la limpieza de servidores temporales y estados")
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(_: FastAPI):
    tarea = asyncio.create_task(_limpieza_periodica())
    yield
    tarea.cancel()


app = FastAPI(title="Kort API", lifespan=lifespan)

# CORS: permite que el frontend (Next.js, otro puerto) llame a esta API
# desde el navegador. Sin esto, el navegador bloquea las peticiones.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)

app.include_router(usuario_router.router, prefix="/api")
app.include_router(auth_router.router, prefix="/api")
app.include_router(servidor_router.router, prefix="/api")
app.include_router(canal_router.router, prefix="/api")
app.include_router(rol_router.router, prefix="/api")
app.include_router(miembro_router.router, prefix="/api")
app.include_router(invitacion_router.router, prefix="/api")
app.include_router(mensaje_router.router, prefix="/api")
app.include_router(estadisticas_router.router, prefix="/api")
app.include_router(voz_router.router, prefix="/api")
app.include_router(archivo_router.router, prefix="/api")
app.include_router(amistad_router.router, prefix="/api")
app.include_router(mensaje_directo_router.router, prefix="/api")
app.include_router(perfil_router.router, prefix="/api")
app.include_router(publicacion_router.router, prefix="/api")
app.include_router(organizacion_router.router, prefix="/api")
# TODO: registrar product_router cuando se implemente
# app.include_router(product_router.router, prefix="/api")


# Archivos subidos por los usuarios (imágenes, audios, videos...): /uploads/<nombre>
CARPETA_UPLOADS.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=CARPETA_UPLOADS), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok"}
