from sqlalchemy.orm import Session

from src.db.models.mensaje_model import Mensaje
from src.db.models.usuario_model import Usuario


class MensajeRepository:
    """Consultas a la tabla `mensajes`. Hace flush; el service confirma (commit)."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, canal_id: int, autor_id: int, contenido: str) -> Mensaje:
        mensaje = Mensaje(canal_id=canal_id, autor_id=autor_id, contenido=contenido, editado=False)
        self.db.add(mensaje)
        self.db.flush()
        return mensaje

    def find_by_id(self, mensaje_id: int) -> Mensaje | None:
        return self.db.query(Mensaje).filter(Mensaje.id == mensaje_id).first()

    def list_by_canal(
        self, canal_id: int, limite: int, antes_de: int | None = None
    ) -> list[tuple[Mensaje, Usuario]]:
        """Paginación por id (HU8): los `limite` mensajes más recientes cuyo id
        sea menor a `antes_de`. Se devuelven del más viejo al más nuevo, que es
        el orden en que se muestran en un chat."""
        consulta = (
            self.db.query(Mensaje, Usuario)
            .join(Usuario, Usuario.id == Mensaje.autor_id)
            .filter(Mensaje.canal_id == canal_id)
        )
        if antes_de is not None:
            consulta = consulta.filter(Mensaje.id < antes_de)

        recientes = consulta.order_by(Mensaje.id.desc()).limit(limite).all()
        return list(reversed(recientes))

    def update(self, mensaje: Mensaje, **campos) -> Mensaje:
        for nombre, valor in campos.items():
            setattr(mensaje, nombre, valor)
        self.db.flush()
        return mensaje

    def delete(self, mensaje: Mensaje) -> None:
        self.db.delete(mensaje)
        self.db.flush()
