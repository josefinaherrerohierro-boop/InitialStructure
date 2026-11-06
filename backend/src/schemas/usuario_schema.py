from pydantic import BaseModel, EmailStr, Field

# Reglas del nombre de usuario: de 3 a 32 caracteres; solo letras, números,
# punto y guion bajo (sin espacios), para que se pueda mencionar fácilmente.
USERNAME_PATTERN = r"^[a-zA-Z0-9_.]+$"


class CreateUsuarioSchema(BaseModel):
    """Lo que manda el cliente para registrarse (HU1)."""

    email: EmailStr
    username: str = Field(min_length=3, max_length=32, pattern=USERNAME_PATTERN)
    # bcrypt solo usa los primeros 72 bytes de la contraseña: por eso el máximo.
    password: str = Field(min_length=8, max_length=72)


class UpdateUsuarioSchema(BaseModel):
    """Campos que el usuario puede cambiar de su propia cuenta. Todos opcionales."""

    email: EmailStr | None = None
    username: str | None = Field(default=None, min_length=3, max_length=32, pattern=USERNAME_PATTERN)
    password: str | None = Field(default=None, min_length=8, max_length=72)
