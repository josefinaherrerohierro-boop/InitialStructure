from pydantic import BaseModel


class PreferenciasDTO(BaseModel):
    tema: str = "oscuro"
    color_primario: str = "#ff6b5b"
    fuente: str = "geist"
    tamanio_fuente: int = 16
    compacto: bool = False

    model_config = {"from_attributes": True}
