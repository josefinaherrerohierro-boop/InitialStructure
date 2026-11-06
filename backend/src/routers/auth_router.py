from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.auth_dto import LoginDTO, TokenDTO
from src.dtos.usuario_dto import UsuarioResponseDTO
from src.mappers.usuario_mapper import to_usuario_response
from src.middlewares.auth_middleware import get_current_user
from src.schemas.auth_schema import LoginSchema, TokenSchema
from src.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenSchema)
def login(payload: LoginSchema, db: Session = Depends(get_db)):
    dto = LoginDTO(**payload.model_dump())
    token: TokenDTO = AuthService(db).login(dto)
    return TokenSchema(**token.model_dump())


@router.get("/me", response_model=UsuarioResponseDTO)
def quien_soy(actual: Usuario = Depends(get_current_user)):
    """Devuelve el usuario conectado (el dueño del token)."""
    return to_usuario_response(actual)
