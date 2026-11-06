from sqlalchemy.orm import Session

from src.db.models.canal_model import Canal


class CanalRepository:
    """Consultas a la tabla `canales`. Hace flush; el service confirma (commit)."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, servidor_id: int, nombre: str, tipo: str, solo_lectura: bool = False) -> Canal:
        canal = Canal(servidor_id=servidor_id, nombre=nombre, tipo=tipo, solo_lectura=solo_lectura)
        self.db.add(canal)
        self.db.flush()
        return canal

    def find_by_id(self, canal_id: int) -> Canal | None:
        return self.db.query(Canal).filter(Canal.id == canal_id).first()

    def find_by_nombre(self, servidor_id: int, nombre: str) -> Canal | None:
        return (
            self.db.query(Canal)
            .filter(Canal.servidor_id == servidor_id, Canal.nombre == nombre)
            .first()
        )

    def list_by_servidor(self, servidor_id: int) -> list[Canal]:
        return self.db.query(Canal).filter(Canal.servidor_id == servidor_id).order_by(Canal.id).all()

    def update(self, canal: Canal, **campos) -> Canal:
        for nombre, valor in campos.items():
            setattr(canal, nombre, valor)
        self.db.flush()
        return canal

    def delete(self, canal: Canal) -> None:
        self.db.delete(canal)
        self.db.flush()
