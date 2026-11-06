from sqlalchemy.orm import Session

from src.db.models.rol_model import ROL_EVERYONE
from src.dtos.servidor_dto import (
    CreateServidorDTO,
    ServidorResponseDTO,
    TransferirServidorDTO,
    UpdateServidorDTO,
)
from src.mappers.servidor_mapper import to_servidor_response
from src.repositories.canal_repository import CanalRepository
from src.repositories.miembro_repository import MiembroRepository
from src.repositories.rol_repository import RolRepository
from src.repositories.servidor_repository import ServidorRepository
from src.services.permisos_service import PermisosService
from src.utils.errors import ForbiddenError, UnprocessableError


class ServidorService:
    """Reglas de negocio de los servidores (HU2)."""

    def __init__(self, db: Session):
        self.db = db
        self.servidores = ServidorRepository(db)
        self.canales = CanalRepository(db)
        self.roles = RolRepository(db)
        self.miembros = MiembroRepository(db)
        self.permisos = PermisosService(db)

    # ---------- HU2: crear servidor ----------
    def create(self, dto: CreateServidorDTO, usuario_id: int) -> ServidorResponseDTO:
        """Crea el servidor y, en la misma transacción:
        1. el creador queda como dueño y como miembro,
        2. se crea el canal de texto `general`,
        3. se crea el rol `@everyone` con permiso para escribir,
        4. el creador recibe el rol `@everyone`.
        Si algo falla, no se guarda nada (rollback).
        """
        nombre = self._limpiar_nombre(dto.nombre)
        try:
            servidor = self.servidores.create(nombre=nombre, duenio_id=usuario_id)
            self.miembros.create(usuario_id=usuario_id, servidor_id=servidor.id)
            self.canales.create(servidor_id=servidor.id, nombre="general", tipo="texto")
            everyone = self.roles.create(
                servidor_id=servidor.id, nombre=ROL_EVERYONE, puede_escribir=True
            )
            self.roles.asignar(usuario_id=usuario_id, rol_id=everyone.id)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

        self.db.refresh(servidor)
        return to_servidor_response(servidor)

    # ---------- HU2: GET /usuarios/{id}/servidores ----------
    def list_de_usuario(self, usuario_id: int, actual_id: int) -> list[ServidorResponseDTO]:
        # Cada uno ve solo su propia lista: es información privada.
        if usuario_id != actual_id:
            raise ForbiddenError("Solo podés ver tus propios servidores")
        return [to_servidor_response(s) for s in self.servidores.list_by_miembro(usuario_id)]

    # ---------- Ver / modificar / borrar ----------
    def get(self, servidor_id: int, actual_id: int) -> ServidorResponseDTO:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_miembro(servidor.id, actual_id)
        return to_servidor_response(servidor)

    def update(self, servidor_id: int, dto: UpdateServidorDTO, actual_id: int) -> ServidorResponseDTO:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_duenio(servidor, actual_id)

        if dto.nombre is not None:
            self.servidores.update(servidor, nombre=self._limpiar_nombre(dto.nombre))
            self.db.commit()
            self.db.refresh(servidor)

        return to_servidor_response(servidor)

    def delete(self, servidor_id: int, actual_id: int) -> None:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_duenio(servidor, actual_id)
        self.servidores.delete(servidor)
        self.db.commit()

    # ---------- HU10: transferir el servidor ----------
    def transferir(self, servidor_id: int, dto: TransferirServidorDTO, actual_id: int) -> ServidorResponseDTO:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_duenio(servidor, actual_id)

        if dto.nuevo_duenio_id == actual_id:
            raise UnprocessableError("Ya sos el dueño de este servidor")
        # Solo se acepta como nuevo dueño a un miembro actual (no baneado).
        if not self.permisos.es_miembro(servidor.id, dto.nuevo_duenio_id):
            raise UnprocessableError("El nuevo dueño tiene que ser un miembro actual del servidor")

        self.servidores.update(servidor, duenio_id=dto.nuevo_duenio_id)
        self.db.commit()
        self.db.refresh(servidor)
        return to_servidor_response(servidor)

    # ---------- Ayudas internas ----------
    @staticmethod
    def _limpiar_nombre(nombre: str) -> str:
        nombre = nombre.strip()
        if not nombre:
            raise UnprocessableError("El nombre del servidor no puede quedar vacío")
        return nombre
