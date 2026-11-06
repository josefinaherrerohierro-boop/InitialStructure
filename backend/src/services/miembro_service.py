from sqlalchemy.orm import Session

from src.dtos.miembro_dto import MiembroResponseDTO
from src.mappers.miembro_mapper import to_miembro_response
from src.repositories.miembro_repository import MiembroRepository
from src.repositories.rol_repository import RolRepository
from src.services.permisos_service import PermisosService


class MiembroService:
    """Consultas y acciones sobre los miembros de un servidor."""

    def __init__(self, db: Session):
        self.db = db
        self.miembros = MiembroRepository(db)
        self.roles = RolRepository(db)
        self.permisos = PermisosService(db)

    def list_by_servidor(self, servidor_id: int, actual_id: int) -> list[MiembroResponseDTO]:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_miembro(servidor.id, actual_id)

        resultado = []
        for miembro, usuario in self.miembros.list_activos(servidor.id):
            roles = self.roles.roles_de_usuario(servidor.id, usuario.id)
            resultado.append(
                to_miembro_response(miembro, usuario, roles, es_duenio=servidor.duenio_id == usuario.id)
            )
        return resultado
