from sqlalchemy.orm import Session

from src.db.models.rol_miembro_model import RolMiembro
from src.db.models.rol_model import ROL_EVERYONE, Rol

# Únicos permisos que se pueden consultar (evita usar cualquier columna por error).
PERMISOS_VALIDOS = ("puede_escribir", "puede_moderar", "puede_invitar")


class RolRepository:
    """Consultas a `roles` y `roles_miembro`. Hace flush; el service confirma (commit)."""

    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        servidor_id: int,
        nombre: str,
        puede_escribir: bool = False,
        puede_moderar: bool = False,
        puede_invitar: bool = False,
    ) -> Rol:
        rol = Rol(
            servidor_id=servidor_id,
            nombre=nombre,
            puede_escribir=puede_escribir,
            puede_moderar=puede_moderar,
            puede_invitar=puede_invitar,
        )
        self.db.add(rol)
        self.db.flush()
        return rol

    def find_everyone(self, servidor_id: int) -> Rol | None:
        return (
            self.db.query(Rol)
            .filter(Rol.servidor_id == servidor_id, Rol.nombre == ROL_EVERYONE)
            .first()
        )

    def asignar(self, usuario_id: int, rol_id: int) -> None:
        self.db.add(RolMiembro(usuario_id=usuario_id, rol_id=rol_id))
        self.db.flush()

    def usuario_tiene_permiso(self, servidor_id: int, usuario_id: int, permiso: str) -> bool:
        """¿El usuario tiene, en ESE servidor, algún rol con el permiso en True?"""
        if permiso not in PERMISOS_VALIDOS:
            raise ValueError(f"Permiso desconocido: {permiso}")

        columna = getattr(Rol, permiso)
        encontrado = (
            self.db.query(Rol.id)
            .join(RolMiembro, RolMiembro.rol_id == Rol.id)
            .filter(
                RolMiembro.usuario_id == usuario_id,
                Rol.servidor_id == servidor_id,
                columna.is_(True),
            )
            .first()
        )
        return encontrado is not None
