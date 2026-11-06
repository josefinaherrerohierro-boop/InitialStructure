from sqlalchemy.orm import Session

from src.db.models.usuario_model import Usuario


class UsuarioRepository:
    """Solo consultas a la tabla `usuarios`. Sin reglas de negocio."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, email: str, username: str, password_hash: str) -> Usuario:
        usuario = Usuario(email=email, username=username, password_hash=password_hash)
        self.db.add(usuario)
        self.db.commit()
        self.db.refresh(usuario)
        return usuario

    def find_by_id(self, usuario_id: int) -> Usuario | None:
        return self.db.query(Usuario).filter(Usuario.id == usuario_id).first()

    def find_by_email(self, email: str) -> Usuario | None:
        return self.db.query(Usuario).filter(Usuario.email == email).first()

    def find_by_username(self, username: str) -> Usuario | None:
        return self.db.query(Usuario).filter(Usuario.username == username).first()

    def list_all(self) -> list[Usuario]:
        return self.db.query(Usuario).order_by(Usuario.id).all()

    def update(self, usuario: Usuario, **campos) -> Usuario:
        for nombre, valor in campos.items():
            setattr(usuario, nombre, valor)
        self.db.commit()
        self.db.refresh(usuario)
        return usuario

    def delete(self, usuario: Usuario) -> None:
        self.db.delete(usuario)
        self.db.commit()
