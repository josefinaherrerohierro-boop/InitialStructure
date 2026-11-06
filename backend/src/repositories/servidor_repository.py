from sqlalchemy.orm import Session

from src.db.models.miembro_model import Miembro
from src.db.models.servidor_model import Servidor


class ServidorRepository:
    """Consultas a la tabla `servidores`.

    A diferencia de UsuarioRepository, estos métodos NO hacen commit: solo
    `flush` (mandan el cambio a la base sin confirmarlo). El commit lo hace
    el service cuando termina toda la operación. Así, crear un servidor con
    su canal, su rol y su primer miembro es "todo o nada" (una transacción).
    """

    def __init__(self, db: Session):
        self.db = db

    def create(self, nombre: str, duenio_id: int) -> Servidor:
        servidor = Servidor(nombre=nombre, duenio_id=duenio_id)
        self.db.add(servidor)
        self.db.flush()  # asigna el id sin confirmar todavía
        return servidor

    def find_by_id(self, servidor_id: int) -> Servidor | None:
        return self.db.query(Servidor).filter(Servidor.id == servidor_id).first()

    def list_by_miembro(self, usuario_id: int) -> list[Servidor]:
        """Servidores donde el usuario es miembro (sin contar los que lo banearon)."""
        return (
            self.db.query(Servidor)
            .join(Miembro, Miembro.servidor_id == Servidor.id)
            .filter(Miembro.usuario_id == usuario_id, Miembro.baneado.is_(False))
            .order_by(Servidor.id)
            .all()
        )

    def update(self, servidor: Servidor, **campos) -> Servidor:
        for nombre, valor in campos.items():
            setattr(servidor, nombre, valor)
        self.db.flush()
        return servidor

    def delete(self, servidor: Servidor) -> None:
        # La base borra en cascada canales, roles, miembros, invitaciones y mensajes.
        self.db.delete(servidor)
        self.db.flush()
