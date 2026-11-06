from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config.env import settings
from src.middlewares.error_middleware import app_error_handler
from src.routers import (
    auth_router,
    canal_router,
    estadisticas_router,
    invitacion_router,
    mensaje_router,
    miembro_router,
    rol_router,
    servidor_router,
    usuario_router,
)
from src.utils.errors import AppError

app = FastAPI(title="Kort API")

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
# TODO: registrar product_router cuando se implemente
# app.include_router(product_router.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
