from sqlalchemy.orm import Session

from src.db.models.preferencias_model import Preferencias


class PreferenciasRepository:
    """Consultas a la tabla `preferencias`. Hace flush; el service confirma (commit)."""

    def __init__(self, db: Session):
        self.db = db

    def find(self, usuario_id: int) -> Preferencias | None:
        return self.db.get(Preferencias, usuario_id)

    def guardar(self, usuario_id: int, **campos) -> Preferencias:
        """Crea la fila la primera vez; después la actualiza."""
        fila = self.find(usuario_id)
        if fila is None:
            fila = Preferencias(usuario_id=usuario_id)
            self.db.add(fila)
        for nombre, valor in campos.items():
            setattr(fila, nombre, valor)
        self.db.flush()
        return fila
