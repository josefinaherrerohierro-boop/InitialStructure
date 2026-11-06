from src.db.models.usuario_model import Usuario
from src.dtos.usuario_dto import UsuarioResponseDTO


def to_usuario_response(usuario: Usuario) -> UsuarioResponseDTO:
    """Convierte el Model SQLAlchemy en el DTO de respuesta (sin password_hash)."""
    return UsuarioResponseDTO.model_validate(usuario)
