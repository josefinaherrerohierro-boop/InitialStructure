"""Tareas de limpieza que corren solas cada minuto (ver app.py)."""

from src.repositories.publicacion_repository import PublicacionRepository
from src.services.servidor_service import ServidorService
from src.utils.fechas import ahora


def limpiar_vencidos(crear_sesion) -> None:
    """Borra los servidores temporales vencidos y los estados de más de 24 horas."""
    db = crear_sesion()
    try:
        ServidorService(db).borrar_vencidos()
        PublicacionRepository(db).borrar_estados_vencidos(ahora())
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
