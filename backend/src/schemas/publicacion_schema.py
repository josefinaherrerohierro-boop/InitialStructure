from pydantic import BaseModel, Field


class CreatePublicacionSchema(BaseModel):
    # Puede no tener texto si tiene imagen (se valida en el service).
    contenido: str = Field(default="", max_length=2000)
    imagen_url: str | None = Field(default=None, max_length=255)
    servidor_id: int | None = Field(default=None, gt=0)
    # Flyer: invitar a un servidor (solo en publicaciones de perfil).
    promocionar_servidor_id: int | None = Field(default=None, gt=0)


class ComentarioSchema(BaseModel):
    contenido: str = Field(min_length=1, max_length=500)


class CreateEstadoSchema(BaseModel):
    contenido: str = Field(default="", max_length=200)
    imagen_url: str | None = Field(default=None, max_length=255)
    color_fondo: str = Field(default="#ff6b5b", pattern=r"^#[0-9a-fA-F]{6}$")
    promocionar_servidor_id: int | None = Field(default=None, gt=0)  # flyer
