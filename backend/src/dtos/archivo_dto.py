from pydantic import BaseModel


class ArchivoResponseDTO(BaseModel):
    """Archivo recién subido. La `url` es relativa al backend (ej: /uploads/abc.png)."""

    url: str
    tipo: str  # 'imagen', 'audio', 'video' o 'archivo'
    nombre: str
    tamanio: int


class AdjuntoDTO(BaseModel):
    """Archivo adjunto a un mensaje."""

    url: str
    tipo: str
    nombre: str | None = None
