"""Guardado de archivos subidos por los usuarios (imágenes, audios, videos...).

Los archivos se guardan en la carpeta `uploads/` del backend y se sirven
como archivos estáticos en /uploads/<nombre> (ver app.py). En la base de
datos solo se guarda esa ruta, por ejemplo "/uploads/3f9c...e1.png".

Por seguridad:
- Solo se aceptan ciertas extensiones (nada de .html, .svg o .js, que el
  navegador podría ejecutar).
- El nombre del archivo en disco es aleatorio: nunca se usa el que mandó
  el usuario (así no puede pisar otros archivos ni usar rutas raras).
"""

import re
import secrets
from pathlib import Path

CARPETA_UPLOADS = Path(__file__).resolve().parents[2] / "uploads"
PREFIJO_URL = "/uploads/"
TAMANIO_MAXIMO = 15 * 1024 * 1024  # 15 MB

# extensión → tipo de adjunto
EXTENSIONES = {
    ".png": "imagen", ".jpg": "imagen", ".jpeg": "imagen", ".gif": "imagen", ".webp": "imagen",
    ".mp3": "audio", ".wav": "audio", ".ogg": "audio", ".m4a": "audio", ".weba": "audio",
    ".mp4": "video", ".mov": "video",
    ".pdf": "archivo", ".txt": "archivo", ".zip": "archivo",
    ".docx": "archivo", ".xlsx": "archivo", ".pptx": "archivo",
}
# .webm puede ser audio (notas de voz grabadas en el navegador) o video.
EXTENSIONES_AMBIGUAS = {".webm"}

PATRON_URL_PROPIA = re.compile(r"^/uploads/[a-f0-9]{32}\.[a-z0-9]{2,5}$")


def tipo_de_archivo(nombre: str, content_type: str | None) -> str | None:
    """Devuelve 'imagen', 'audio', 'video' o 'archivo', o None si no se acepta."""
    extension = Path(nombre).suffix.lower()
    if extension in EXTENSIONES:
        return EXTENSIONES[extension]
    if extension in EXTENSIONES_AMBIGUAS:
        return "video" if (content_type or "").startswith("video/") else "audio"
    return None


def guardar(contenido: bytes, nombre_original: str) -> str:
    """Guarda el archivo con un nombre aleatorio y devuelve su URL relativa."""
    CARPETA_UPLOADS.mkdir(parents=True, exist_ok=True)
    extension = Path(nombre_original).suffix.lower()
    nombre = f"{secrets.token_hex(16)}{extension}"
    (CARPETA_UPLOADS / nombre).write_bytes(contenido)
    return f"{PREFIJO_URL}{nombre}"


def es_url_propia(url: str | None) -> bool:
    """True si la URL apunta a un archivo subido a Kort (y no a cualquier sitio)."""
    return bool(url) and PATRON_URL_PROPIA.match(url) is not None and (CARPETA_UPLOADS / url[len(PREFIJO_URL):]).is_file()
