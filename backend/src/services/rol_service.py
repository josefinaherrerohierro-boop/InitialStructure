from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.db.models.rol_model import ROL_EVERYONE, Rol
from src.dtos.rol_dto import CreateRolDTO, RolResponseDTO, UpdateRolDTO
from src.mappers.rol_mapper import to_rol_response
from src.repositories.rol_repository import RolRepository
from src.services.permisos_service import PermisosService
from src.utils.errors import ConflictError, NotFoundError, UnprocessableError


class RolService:
    """Reglas de negocio de los roles (HU4). Solo el dueño administra roles."""

    def __init__(self, db: Session):
        self.db = db
        self.roles = RolRepository(db)
        self.permisos = PermisosService(db)

    # ---------- Crear rol ----------
    def create(self, servidor_id: int, dto: CreateRolDTO, actual_id: int) -> RolResponseDTO:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_duenio(servidor, actual_id)

        nombre = self._limpiar_nombre(dto.nombre)
        self._verificar_nombre_libre(servidor.id, nombre)

        try:
            rol = self.roles.create(
                servidor_id=servidor.id,
                nombre=nombre,
                puede_escribir=dto.puede_escribir,
                puede_moderar=dto.puede_moderar,
                puede_invitar=dto.puede_invitar,
            )
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise ConflictError("Ya existe un rol con ese nombre en este servidor")

        return to_rol_response(rol)

    # ---------- Listar roles (cualquier miembro) ----------
    def list_by_servidor(self, servidor_id: int, actual_id: int) -> list[RolResponseDTO]:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_miembro(servidor.id, actual_id)
        return [to_rol_response(r) for r in self.roles.list_by_servidor(servidor.id)]

    # ---------- Modificar rol ----------
    def update(self, rol_id: int, dto: UpdateRolDTO, actual_id: int) -> RolResponseDTO:
        rol = self._buscar_o_404(rol_id)
        servidor = self.permisos.obtener_servidor(rol.servidor_id)
        self.permisos.exigir_duenio(servidor, actual_id)

        cambios = {}
        if dto.nombre is not None:
            nombre = self._limpiar_nombre(dto.nombre)
            if nombre != rol.nombre:
                # Los permisos de @everyone se pueden cambiar, pero no su nombre:
                # el sistema lo busca por ese nombre para los nuevos miembros.
                if rol.nombre == ROL_EVERYONE:
                    raise UnprocessableError("No se puede cambiar el nombre del rol @everyone")
                if nombre.lower() != rol.nombre.lower():
                    self._verificar_nombre_libre(servidor.id, nombre)
                cambios["nombre"] = nombre
        for permiso in ("puede_escribir", "puede_moderar", "puede_invitar"):
            valor = getattr(dto, permiso)
            if valor is not None:
                cambios[permiso] = valor

        if cambios:
            try:
                self.roles.update(rol, **cambios)
                self.db.commit()
            except IntegrityError:
                self.db.rollback()
                raise ConflictError("Ya existe un rol con ese nombre en este servidor")

        return to_rol_response(rol)

    # ---------- Borrar rol ----------
    def delete(self, rol_id: int, actual_id: int) -> None:
        rol = self._buscar_o_404(rol_id)
        servidor = self.permisos.obtener_servidor(rol.servidor_id)
        self.permisos.exigir_duenio(servidor, actual_id)

        # HU4: el rol @everyone no se puede borrar.
        if rol.nombre == ROL_EVERYONE:
            raise UnprocessableError("No se puede borrar el rol @everyone")

        self.roles.delete(rol)
        self.db.commit()

    # ---------- Asignar / quitar un rol a un miembro ----------
    def asignar(self, servidor_id: int, usuario_id: int, rol_id: int, actual_id: int) -> None:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_duenio(servidor, actual_id)
        rol = self._validar_rol_y_miembro(servidor.id, usuario_id, rol_id)

        if self.roles.tiene_rol(usuario_id, rol.id):
            raise ConflictError("Ese miembro ya tiene ese rol")

        self.roles.asignar(usuario_id=usuario_id, rol_id=rol.id)
        self.db.commit()

    def quitar(self, servidor_id: int, usuario_id: int, rol_id: int, actual_id: int) -> None:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_duenio(servidor, actual_id)
        rol = self._validar_rol_y_miembro(servidor.id, usuario_id, rol_id)

        # Todo miembro conserva @everyone mientras pertenezca al servidor
        # (se quita solo al salir, ser expulsado o baneado).
        if rol.nombre == ROL_EVERYONE:
            raise UnprocessableError("No se puede quitar el rol @everyone a un miembro")
        if not self.roles.tiene_rol(usuario_id, rol.id):
            raise NotFoundError("Ese miembro no tiene ese rol")

        self.roles.quitar(usuario_id=usuario_id, rol_id=rol.id)
        self.db.commit()

    # ---------- Ayudas internas ----------
    def _validar_rol_y_miembro(self, servidor_id: int, usuario_id: int, rol_id: int) -> Rol:
        rol = self._buscar_o_404(rol_id)
        # HU4: un rol de un servidor no se puede asignar en otro servidor.
        if rol.servidor_id != servidor_id:
            raise UnprocessableError("Ese rol pertenece a otro servidor")
        # HU4: solo se puede asignar un rol a alguien que es miembro del servidor.
        if not self.permisos.es_miembro(servidor_id, usuario_id):
            raise UnprocessableError("Ese usuario no es miembro de este servidor")
        return rol

    def _buscar_o_404(self, rol_id: int) -> Rol:
        rol = self.roles.find_by_id(rol_id)
        if rol is None:
            raise NotFoundError("Rol no encontrado")
        return rol

    def _verificar_nombre_libre(self, servidor_id: int, nombre: str) -> None:
        if self.roles.find_by_nombre(servidor_id, nombre) is not None:
            raise ConflictError("Ya existe un rol con ese nombre en este servidor")

    @staticmethod
    def _limpiar_nombre(nombre: str) -> str:
        nombre = nombre.strip()
        if not nombre:
            raise UnprocessableError("El nombre del rol no puede quedar vacío")
        return nombre
