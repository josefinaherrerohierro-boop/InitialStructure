from sqlalchemy.orm import Session

from src.db.models.preferencias_model import DISPOSICIONES, FUENTES, TEMAS
from src.dtos.preferencias_dto import PreferenciasDTO
from src.repositories.preferencias_repository import PreferenciasRepository
from src.utils.errors import UnprocessableError


class PreferenciasService:
    """Apariencia que elige cada usuario: tema, color, tipografía y tamaño.
    Se guarda en la cuenta, así se ve igual en cualquier dispositivo."""

    def __init__(self, db: Session):
        self.db = db
        self.preferencias = PreferenciasRepository(db)

    def obtener(self, usuario_id: int) -> PreferenciasDTO:
        fila = self.preferencias.find(usuario_id)
        # Si nunca cambió nada, devolvemos los valores por defecto.
        return PreferenciasDTO.model_validate(fila) if fila else PreferenciasDTO()

    def guardar(self, usuario_id: int, dto: PreferenciasDTO) -> PreferenciasDTO:
        if dto.tema not in TEMAS:
            raise UnprocessableError("Tema inválido")
        if dto.fuente not in FUENTES:
            raise UnprocessableError("Tipografía inválida")
        if not 12 <= dto.tamanio_fuente <= 20:
            raise UnprocessableError("El tamaño de letra va de 12 a 20")
        if dto.disposicion not in DISPOSICIONES:
            raise UnprocessableError("Disposición inválida")

        fila = self.preferencias.guardar(
            usuario_id,
            tema=dto.tema,
            color_primario=dto.color_primario.lower(),
            fuente=dto.fuente,
            tamanio_fuente=dto.tamanio_fuente,
            compacto=dto.compacto,
            disposicion=dto.disposicion,
        )
        self.db.commit()
        return PreferenciasDTO.model_validate(fila)
