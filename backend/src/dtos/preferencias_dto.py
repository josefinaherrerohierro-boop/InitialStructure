from pydantic import BaseModel


class PreferenciasDTO(BaseModel):
    tema: str = "kort"
    color_primario: str = "#e2553d"
    fuente: str = "geist"
    tamanio_fuente: int = 16
    compacto: bool = False

    model_config = {"from_attributes": True}
