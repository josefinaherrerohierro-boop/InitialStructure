from pydantic import BaseModel, Field


class PreferenciasSchema(BaseModel):
    tema: str = Field(pattern=r"^(kort|oscuro|medianoche|claro|bosque|atardecer)$")
    color_primario: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    fuente: str = Field(pattern=r"^(geist|inter|nunito|lora|space-grotesk|atkinson|mono)$")
    tamanio_fuente: int = Field(ge=12, le=20)
    compacto: bool = False
