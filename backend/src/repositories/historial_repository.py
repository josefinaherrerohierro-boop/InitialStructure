from sqlalchemy.orm import Session

from src.db.models.historial_model import HistorialServidor
from src.db.models.servidor_model import Servidor
from src.utils.fechas import ahora


class HistorialRepository:
    """Consultas a `historial_servidores`. Hace flush; el service confirma (commit)."""

    def __init__(self, db: Session):
        self.db = db

    def abrir(self, usuario_id: int, servidor: Servidor) -> HistorialServidor:
        """Registra que el usuario entró al servidor."""
        fila = HistorialServidor(usuario_id=usuario_id, servidor_id=servidor.id, servidor_nombre=servidor.nombre)
        self.db.add(fila)
        self.db.flush()
        return fila

    def cerrar(self, usuario_id: int, servidor_id: int, motivo: str) -> None:
        """Registra que el usuario salió (o lo sacaron) del servidor."""
        self.db.query(HistorialServidor).filter(
            HistorialServidor.usuario_id == usuario_id,
            HistorialServidor.servidor_id == servidor_id,
            HistorialServidor.fecha_salida.is_(None),
        ).update(
            {HistorialServidor.fecha_salida: ahora(), HistorialServidor.motivo_salida: motivo},
            synchronize_session=False,
        )
        self.db.flush()

    def cerrar_todos(self, servidor: Servidor, motivo: str) -> None:
        """Antes de borrar un servidor: cierra la membresía de todos y guarda su último nombre."""
        self.db.query(HistorialServidor).filter(
            HistorialServidor.servidor_id == servidor.id,
            HistorialServidor.fecha_salida.is_(None),
        ).update(
            {
                HistorialServidor.fecha_salida: ahora(),
                HistorialServidor.motivo_salida: motivo,
                HistorialServidor.servidor_nombre: servidor.nombre,
            },
            synchronize_session=False,
        )
        self.db.flush()

    def list_de_usuario(self, usuario_id: int) -> list[tuple[HistorialServidor, Servidor | None]]:
        return (
            self.db.query(HistorialServidor, Servidor)
            .outerjoin(Servidor, Servidor.id == HistorialServidor.servidor_id)
            .filter(HistorialServidor.usuario_id == usuario_id)
            .order_by(HistorialServidor.fecha_union.desc(), HistorialServidor.id.desc())
            .all()
        )
