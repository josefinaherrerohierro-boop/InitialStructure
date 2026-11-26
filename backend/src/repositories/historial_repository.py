import json

from sqlalchemy.orm import Session

from src.db.models.historial_model import HistorialServidor
from src.db.models.rol_model import ROL_EVERYONE
from src.db.models.servidor_model import Servidor
from src.repositories.rol_repository import RolRepository
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

    def roles_actuales(self, usuario_id: int, servidor: Servidor) -> list[str]:
        """Roles que tiene hoy el usuario en el servidor, para mostrar en el historial:
        "Dueño" si lo es, y después los nombres de sus roles (sin @everyone)."""
        roles = ["Dueño"] if servidor.duenio_id == usuario_id else []
        roles += [r.nombre for r in RolRepository(self.db).roles_de_usuario(servidor.id, usuario_id) if r.nombre != ROL_EVERYONE]
        return roles

    def cerrar(self, usuario_id: int, servidor: Servidor, motivo: str) -> None:
        """Registra que el usuario salió (o lo sacaron) del servidor y guarda los
        roles que tenía. Hay que llamarlo ANTES de quitarle los roles."""
        roles = json.dumps(self.roles_actuales(usuario_id, servidor), ensure_ascii=False)
        self.db.query(HistorialServidor).filter(
            HistorialServidor.usuario_id == usuario_id,
            HistorialServidor.servidor_id == servidor.id,
            HistorialServidor.fecha_salida.is_(None),
        ).update(
            {
                HistorialServidor.fecha_salida: ahora(),
                HistorialServidor.motivo_salida: motivo,
                HistorialServidor.roles: roles,
            },
            synchronize_session=False,
        )
        self.db.flush()

    def cerrar_todos(self, servidor: Servidor, motivo: str) -> None:
        """Antes de borrar un servidor: cierra la membresía de todos, guarda su
        último nombre y los roles que tenía cada uno."""
        abiertas = (
            self.db.query(HistorialServidor)
            .filter(HistorialServidor.servidor_id == servidor.id, HistorialServidor.fecha_salida.is_(None))
            .all()
        )
        momento = ahora()
        for fila in abiertas:
            fila.fecha_salida = momento
            fila.motivo_salida = motivo
            fila.servidor_nombre = servidor.nombre
            fila.roles = json.dumps(self.roles_actuales(fila.usuario_id, servidor), ensure_ascii=False)
        self.db.flush()

    def fecha_baneo(self, usuario_id: int, servidor_id: int):
        """Cuándo lo banearon de ese servidor (la última vez), o None si no hay registro."""
        fila = (
            self.db.query(HistorialServidor.fecha_salida)
            .filter(
                HistorialServidor.usuario_id == usuario_id,
                HistorialServidor.servidor_id == servidor_id,
                HistorialServidor.motivo_salida == "baneado",
            )
            .order_by(HistorialServidor.fecha_salida.desc())
            .first()
        )
        return fila[0] if fila else None

    def list_de_usuario(self, usuario_id: int) -> list[tuple[HistorialServidor, Servidor | None]]:
        return (
            self.db.query(HistorialServidor, Servidor)
            .outerjoin(Servidor, Servidor.id == HistorialServidor.servidor_id)
            .filter(HistorialServidor.usuario_id == usuario_id)
            .order_by(HistorialServidor.fecha_union.desc(), HistorialServidor.id.desc())
            .all()
        )
