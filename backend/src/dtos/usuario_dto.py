from datetime import datetime

from pydantic import BaseModel


class CreateUsuarioDTO(BaseModel):
    email: str
    username: str
    password: str


class UpdateUsuarioDTO(BaseModel):
    email: str | None = None
    username: str | None = None
    password: str | None = None


class UsuarioResponseDTO(BaseModel):
    """Lo que se devuelve al cliente: nunca incluye password_hash."""

    id: int
    email: str
    username: str
    fecha_registro: datetime

    model_config = {"from_attributes": True}
