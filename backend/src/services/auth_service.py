from sqlalchemy.orm import Session

from src.dtos.auth_dto import LoginDTO, TokenDTO
from src.repositories.usuario_repository import UsuarioRepository
from src.utils.errors import UnauthorizedError
from src.utils.hash import verify_password
from src.utils.jwt import create_access_token


class AuthService:
    def __init__(self, db: Session):
        self.repo = UsuarioRepository(db)

    def login(self, dto: LoginDTO) -> TokenDTO:
        usuario = self.repo.find_by_email(dto.email.strip().lower())
        # Mismo mensaje si falla el email o la contraseña: así no se revela
        # qué emails están registrados.
        if not usuario or not verify_password(dto.password, usuario.password_hash):
            raise UnauthorizedError("Email o contraseña incorrectos")

        token = create_access_token({"sub": str(usuario.id), "username": usuario.username})
        return TokenDTO(access_token=token)
