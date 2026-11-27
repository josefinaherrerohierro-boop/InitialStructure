"""Archivos subidos por los usuarios: /uploads/<nombre>.

Antes se servían con StaticFiles, pero la versión de Starlette que usa
FastAPI 0.115 no entiende el encabezado "Range". Sin eso, el navegador no
puede pedir un pedazo del video y no deja adelantarlo ni retrocederlo.
Acá se responde a mano:

- Sin "Range" (o con uno que no se entiende): el archivo completo (200),
  avisando que acepta rangos.
- Con "Range: bytes=inicio-fin": solo ese pedazo (206 Partial Content).
- Con un rango imposible: 416 Range Not Satisfiable.
"""

import re

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, Response, StreamingResponse

from src.utils.archivos import CARPETA_UPLOADS, PATRON_URL_PROPIA, PREFIJO_URL

router = APIRouter(tags=["archivos"])

TAMANIO_PEDAZO = 256 * 1024  # se manda de a 256 KB

# Tipo de cada extensión que acepta Kort (así no depende de la configuración de Windows).
TIPOS = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".weba": "audio/webm",
    ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
    ".pdf": "application/pdf", ".txt": "text/plain; charset=utf-8", ".zip": "application/zip",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

PATRON_RANGO = re.compile(r"^bytes=(\d*)-(\d*)$")


def _leer(ruta, inicio: int, fin: int):
    """Lee el archivo desde `inicio` hasta `fin` (incluido), de a pedazos."""
    with open(ruta, "rb") as archivo:
        archivo.seek(inicio)
        quedan = fin - inicio + 1
        while quedan > 0:
            datos = archivo.read(min(TAMANIO_PEDAZO, quedan))
            if not datos:
                break
            quedan -= len(datos)
            yield datos


@router.api_route("/uploads/{nombre}", methods=["GET", "HEAD"], include_in_schema=False)
def archivo_subido(nombre: str, request: Request):
    # Solo nombres generados por Kort (32 letras/números al azar + extensión): nada de rutas raras.
    ruta = CARPETA_UPLOADS / nombre
    if not PATRON_URL_PROPIA.match(f"{PREFIJO_URL}{nombre}") or not ruta.is_file():
        return Response(status_code=404)

    tamanio = ruta.stat().st_size
    tipo = TIPOS.get(ruta.suffix.lower(), "application/octet-stream")
    base = {"Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=86400"}

    rango = request.headers.get("range")
    m = PATRON_RANGO.match(rango.strip()) if rango else None
    # Sin rango, o con uno que no entendemos (ej: varios rangos juntos): el archivo completo.
    if m is None or (m.group(1) == "" and m.group(2) == ""):
        if request.method == "HEAD":
            return Response(headers={**base, "Content-Length": str(tamanio)}, media_type=tipo)
        return FileResponse(ruta, media_type=tipo, headers=base)

    # "bytes=100-199", "bytes=100-" (hasta el final) o "bytes=-500" (los últimos 500).
    if m.group(1) == "":
        inicio, fin = max(tamanio - int(m.group(2)), 0), tamanio - 1
    else:
        inicio = int(m.group(1))
        fin = min(int(m.group(2)), tamanio - 1) if m.group(2) else tamanio - 1
    if tamanio == 0 or inicio >= tamanio or inicio > fin:
        return Response(status_code=416, headers={**base, "Content-Range": f"bytes */{tamanio}"})

    encabezados = {
        **base,
        "Content-Range": f"bytes {inicio}-{fin}/{tamanio}",
        "Content-Length": str(fin - inicio + 1),
    }
    if request.method == "HEAD":
        return Response(status_code=206, headers=encabezados, media_type=tipo)
    return StreamingResponse(_leer(ruta, inicio, fin), status_code=206, headers=encabezados, media_type=tipo)
