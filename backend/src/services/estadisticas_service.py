from datetime import timedelta

from sqlalchemy.orm import Session

from src.dtos.estadisticas_dto import (
    CanalInactivoDTO,
    CantidadPorMesDTO,
    CrecimientoDTO,
    TopUsuarioDTO,
)
from src.repositories.estadisticas_repository import EstadisticasRepository
from src.services.permisos_service import PermisosService
from src.utils.fechas import ahora

DIAS_DE_ACTIVIDAD = 30
CANTIDAD_TOP = 10


class EstadisticasService:
    """Estadísticas del servidor (HU11, HU12). Solo las ve el dueño."""

    def __init__(self, db: Session):
        self.repo = EstadisticasRepository(db)
        self.permisos = PermisosService(db)

    def _validar_duenio(self, servidor_id: int, actual_id: int) -> int:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_duenio(servidor, actual_id)
        return servidor.id

    # ---------- HU11 ----------
    def top_usuarios(self, servidor_id: int, actual_id: int) -> list[TopUsuarioDTO]:
        servidor_id = self._validar_duenio(servidor_id, actual_id)
        desde = ahora() - timedelta(days=DIAS_DE_ACTIVIDAD)
        filas = self.repo.top_usuarios(servidor_id, desde, limite=CANTIDAD_TOP)
        return [
            TopUsuarioDTO(usuario_id=f.id, username=f.username, cantidad_mensajes=f.cantidad_mensajes)
            for f in filas
        ]

    def canales_inactivos(self, servidor_id: int, actual_id: int) -> list[CanalInactivoDTO]:
        servidor_id = self._validar_duenio(servidor_id, actual_id)
        desde = ahora() - timedelta(days=DIAS_DE_ACTIVIDAD)
        filas = self.repo.canales_inactivos(servidor_id, desde)
        return [
            CanalInactivoDTO(canal_id=f.id, nombre=f.nombre, ultimo_mensaje=f.ultimo_mensaje)
            for f in filas
        ]

    # ---------- HU12 ----------
    def crecimiento(self, servidor_id: int, actual_id: int) -> CrecimientoDTO:
        servidor_id = self._validar_duenio(servidor_id, actual_id)
        return CrecimientoDTO(
            total_miembros_actuales=self.repo.total_miembros_actuales(servidor_id),
            miembros_por_mes=[
                CantidadPorMesDTO(mes=f.mes, cantidad=f.cantidad)
                for f in self.repo.miembros_por_mes(servidor_id)
            ],
            mensajes_por_mes=[
                CantidadPorMesDTO(mes=f.mes, cantidad=f.cantidad)
                for f in self.repo.mensajes_por_mes(servidor_id)
            ],
        )
