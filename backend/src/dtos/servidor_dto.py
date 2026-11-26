from datetime import datetime

from pydantic import BaseModel


class CreateServidorDTO(BaseModel):
    nombre: str
    duracion_horas: int | None = None
    clave_borrado: str | None = None
    publico: bool = False
    descripcion: str = ""


class UpdateServidorDTO(BaseModel):
    nombre: str | None = None
    duracion_horas: int | None = None
    hacer_permanente: bool = False
    icono_url: str | None = None
    quitar_icono: bool = False
    publico: bool | None = None
    descripcion: str | None = None


class ServidorResponseDTO(BaseModel):
    id: int
    nombre: str
    duenio_id: int
    fecha_creacion: datetime
    expira_en: datetime | None = None  # None = permanente
    icono_url: str | None = None  # foto del servidor
    tiene_clave_borrado: bool = False  # si se borra con su propia contraseña
    publico: bool = False
    descripcion: str = ""

    model_config = {"from_attributes": True}


class TransferirServidorDTO(BaseModel):
    nuevo_duenio_id: int


class ServidorPublicoDTO(BaseModel):
    """Un servidor público, como se ve en Explorar."""

    id: int
    nombre: str
    descripcion: str
    icono_url: str | None
    miembros: int
    fecha_creacion: datetime
    expira_en: datetime | None
    soy_miembro: bool
