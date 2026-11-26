"""Tareas de limpieza que corren solas cada minuto (ver app.py)."""

import logging

from src.repositories.publicacion_repository import PublicacionRepository
from src.services.servidor_service import ServidorService
from src.utils.fechas import ahora

log = logging.getLogger("kort")


def limpiar_vencidos(crear_sesion) -> None:
    """Borra los servidores temporales vencidos, los estados de más de 24 horas
    y las publicaciones que quedaron vacías. Cada paso es independiente: si
    uno falla, los otros se hacen igual."""
    db = crear_sesion()
    try:
        ServidorService(db).borrar_vencidos()  # maneja sus propios errores
        for paso in (
            lambda r: r.borrar_estados_vencidos(ahora()),
            lambda r: r.borrar_vacias(),
        ):
            try:
                paso(PublicacionRepository(db))
                db.commit()
            except Exception:
                db.rollback()
                log.exception("Falló un paso de la limpieza automática")
    finally:
        db.close()
