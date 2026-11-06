from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.db.models.canal_model import Canal
from src.dtos.canal_dto import CanalResponseDTO, CreateCanalDTO, UpdateCanalDTO
from src.mappers.canal_mapper import to_canal_response
from src.repositories.canal_repository import CanalRepository
from src.services.permisos_service import PermisosService
from src.utils.errors import ConflictError, NotFoundError, UnprocessableError


def normalizar_nombre_canal(nombre: str) -> str:
    """'Sala de Estudio ' → 'sala-de-estudio' (como hace Discord).
    Así "General" y "general" no pueden existir los dos en el mismo servidor."""
    return "-".join(nombre.strip().lower().split())


class CanalService:
    """Reglas de negocio de los canales (HU3)."""

    def __init__(self, db: Session):
        self.db = db
        self.canales = CanalRepository(db)
        self.permisos = PermisosService(db)

    # ---------- HU3: crear canal ----------
    def create(self, servidor_id: int, dto: CreateCanalDTO, actual_id: int) -> CanalResponseDTO:
        servidor = self.permisos.obtener_servidor(servidor_id)
        # Solo el dueño o un miembro con un rol con puede_moderar = true.
        self.permisos.exigir_moderador(servidor, actual_id)

        nombre = normalizar_nombre_canal(dto.nombre)
        self._verificar_nombre_libre(servidor.id, nombre)

        try:
            canal = self.canales.create(
                servidor_id=servidor.id,
                nombre=nombre,
                tipo=dto.tipo,
                solo_lectura=dto.solo_lectura,
            )
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise ConflictError("Ya existe un canal con ese nombre en este servidor")

        return to_canal_response(canal)

    # ---------- HU3: GET /servidores/{id}/canales ----------
    def list_by_servidor(self, servidor_id: int, actual_id: int) -> list[CanalResponseDTO]:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_miembro(servidor.id, actual_id)
        return [to_canal_response(c) for c in self.canales.list_by_servidor(servidor.id)]

    # ---------- Modificar / borrar (dueño o moderador) ----------
    def update(self, canal_id: int, dto: UpdateCanalDTO, actual_id: int) -> CanalResponseDTO:
        canal = self._buscar_o_404(canal_id)
        servidor = self.permisos.obtener_servidor(canal.servidor_id)
        self.permisos.exigir_moderador(servidor, actual_id)

        cambios = {}
        if dto.nombre is not None:
            nombre = normalizar_nombre_canal(dto.nombre)
            if nombre != canal.nombre:
                self._verificar_nombre_libre(servidor.id, nombre)
                cambios["nombre"] = nombre
        if dto.solo_lectura is not None:
            cambios["solo_lectura"] = dto.solo_lectura

        if cambios:
            try:
                self.canales.update(canal, **cambios)
                self.db.commit()
            except IntegrityError:
                self.db.rollback()
                raise ConflictError("Ya existe un canal con ese nombre en este servidor")

        return to_canal_response(canal)

    def delete(self, canal_id: int, actual_id: int) -> None:
        canal = self._buscar_o_404(canal_id)
        servidor = self.permisos.obtener_servidor(canal.servidor_id)
        self.permisos.exigir_moderador(servidor, actual_id)
        self.canales.delete(canal)
        self.db.commit()

    # ---------- Ayudas internas ----------
    def _buscar_o_404(self, canal_id: int) -> Canal:
        canal = self.canales.find_by_id(canal_id)
        if canal is None:
            raise NotFoundError("Canal no encontrado")
        return canal

    def _verificar_nombre_libre(self, servidor_id: int, nombre: str) -> None:
        if not nombre:
            raise UnprocessableError("El nombre del canal no puede quedar vacío")
        if self.canales.find_by_nombre(servidor_id, nombre) is not None:
            raise ConflictError("Ya existe un canal con ese nombre en este servidor")
