from pydantic import BaseModel, Field


class CreateServidorSchema(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    # Servidor temporal: se borra solo después de estas horas (máximo 30 días).
    # Si no se manda, el servidor es permanente.
    duracion_horas: int | None = Field(default=None, ge=1, le=720)
    # Contraseña que se va a pedir para borrar el servidor (bcrypt usa hasta 72 bytes).
    clave_borrado: str = Field(min_length=4, max_length=72)
    publico: bool = False
    descripcion: str = Field(default="", max_length=300)


class UpdateServidorSchema(BaseModel):
    nombre: str | None = Field(default=None, min_length=2, max_length=100)
    # Para servidores temporales: nueva duración contando desde ahora,
    # o hacer_permanente = true para que no se borre nunca.
    duracion_horas: int | None = Field(default=None, ge=1, le=720)
    hacer_permanente: bool = False
    # Foto del servidor: una imagen subida con POST /archivos. quitar_icono = volver a las iniciales.
    icono_url: str | None = Field(default=None, max_length=255)
    quitar_icono: bool = False
    publico: bool | None = None
    descripcion: str | None = Field(default=None, max_length=300)


class OrdenServidoresSchema(BaseModel):
    # Ids de mis servidores en el orden en que los quiero ver.
    servidor_ids: list[int] = Field(max_length=500)


class TransferirServidorSchema(BaseModel):
    # HU10: id del miembro que pasa a ser el nuevo dueño.
    nuevo_duenio_id: int = Field(gt=0)


class BorrarServidorSchema(BaseModel):
    # La contraseña de borrado del servidor (o la de tu cuenta, si el servidor no tiene una).
    clave: str = Field(min_length=1, max_length=72)


class CambiarClaveBorradoSchema(BaseModel):
    # Para cambiarla hay que confirmar con la contraseña de la cuenta (sirve si te la olvidaste).
    password_cuenta: str = Field(min_length=1, max_length=72)
    nueva_clave: str = Field(min_length=4, max_length=72)
