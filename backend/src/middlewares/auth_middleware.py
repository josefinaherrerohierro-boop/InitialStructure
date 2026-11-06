from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.repositories.usuario_repository import UsuarioRepository
from src.utils.errors import UnauthorizedError
from src.utils.jwt import decode_token

# HTTPBearer lee el header "Authorization: Bearer <token>" y además agrega
# el botón "Authorize" en Swagger (/docs) para probar con el token.
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    """Devuelve el usuario dueño del token. Si no hay token válido → 401."""
    if credentials is None:
        raise UnauthorizedError("Falta el token. Iniciá sesión primero.")

    payload = decode_token(credentials.credentials)

    usuario_id = payload.get("sub")
    if usuario_id is None:
        raise UnauthorizedError("Token inválido")

    usuario = UsuarioRepository(db).find_by_id(int(usuario_id))
    if usuario is None:
        raise UnauthorizedError("El usuario del token ya no existe")

    return usuario
