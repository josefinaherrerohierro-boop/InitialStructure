from pydantic import BaseModel, Field


class RedSocialSchema(BaseModel):
    red: str = Field(pattern=r"^(instagram|x|tiktok|youtube|twitch|github|spotify|linkedin|web)$")
    # Solo links http/https (nada de "javascript:...").
    url: str = Field(max_length=255, pattern=r"^https?://\S+$")


class UpdatePerfilSchema(BaseModel):
    """Todos opcionales: solo se cambia lo que se manda. Las listas reemplazan a las anteriores."""

    bio: str | None = Field(default=None, max_length=190)
    etiquetas: list[str] | None = Field(default=None, max_length=10)
    redes: list[RedSocialSchema] | None = Field(default=None, max_length=9)


class FotoPerfilSchema(BaseModel):
    url: str = Field(max_length=255)
