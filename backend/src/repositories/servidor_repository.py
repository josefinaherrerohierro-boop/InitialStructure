from datetime import datetime

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from src.db.models.miembro_model import Miembro
from src.db.models.servidor_model import Servidor


class ServidorRepository:
    """Consultas a la tabla `servidores`.

    A diferencia de UsuarioRepository, estos métodos NO hacen commit: solo
    `flush` (mandan el cambio a la base sin confirmarlo). El commit lo hace
    el service cuando termina toda la operación. Así, crear un servidor con
    su canal, su rol y su primer miembro es "todo o nada" (una transacción).
    """

    def __init__(self, db: Session):
        self.db = db

    def create(self, nombre: str, duenio_id: int, expira_en: datetime | None = None) -> Servidor:
        servidor = Servidor(nombre=nombre, duenio_id=duenio_id, expira_en=expira_en)
        self.db.add(servidor)
        self.db.flush()  # asigna el id sin confirmar todavía
        return servidor

    def find_by_id(self, servidor_id: int) -> Servidor | None:
        return self.db.query(Servidor).filter(Servidor.id == servidor_id).first()

    def explorar(self, texto: str, orden: str, ahora: datetime, limite: int, desplazamiento: int):
        """Servidores públicos (no vencidos) con su cantidad de miembros.
        Busca en el nombre y la descripción. orden: 'populares' o 'nuevos'."""
        miembros = func.count(Miembro.usuario_id).label("miembros")
        consulta = (
            self.db.query(Servidor, miembros)
            .outerjoin(Miembro, (Miembro.servidor_id == Servidor.id) & Miembro.baneado.is_(False))
            .filter(Servidor.publico.is_(True))
            .filter(or_(Servidor.expira_en.is_(None), Servidor.expira_en > ahora))
            .group_by(Servidor.id)
        )
        if texto:
            patron = "%" + texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
            consulta = consulta.filter(
                or_(Servidor.nombre.ilike(patron, escape="\\"), Servidor.descripcion.ilike(patron, escape="\\"))
            )
        if orden == "nuevos":
            consulta = consulta.order_by(Servidor.fecha_creacion.desc(), Servidor.id.desc())
        else:
            consulta = consulta.order_by(miembros.desc(), Servidor.fecha_creacion.desc())
        return consulta.offset(desplazamiento).limit(limite).all()

    def list_vencidos(self, ahora: datetime) -> list[Servidor]:
        """Servidores temporales cuya fecha de vencimiento ya pasó."""
        return self.db.query(Servidor).filter(Servidor.expira_en.isnot(None), Servidor.expira_en <= ahora).all()

    def list_by_miembro(self, usuario_id: int, ahora: datetime) -> list[Servidor]:
        """Servidores donde el usuario es miembro (sin contar los que lo banearon
        ni los temporales vencidos), en el orden que eligió el usuario. Los que
        todavía no ordenó van al final, por fecha de unión."""
        return (
            self.db.query(Servidor)
            .join(Miembro, Miembro.servidor_id == Servidor.id)
            .filter(Miembro.usuario_id == usuario_id, Miembro.baneado.is_(False))
            .filter(or_(Servidor.expira_en.is_(None), Servidor.expira_en > ahora))
            .order_by(Miembro.posicion.is_(None), Miembro.posicion, Miembro.fecha_union, Servidor.id)
            .all()
        )

    def update(self, servidor: Servidor, **campos) -> Servidor:
        for nombre, valor in campos.items():
            setattr(servidor, nombre, valor)
        self.db.flush()
        return servidor

    def delete(self, servidor: Servidor) -> None:
        # La base borra en cascada canales, roles, miembros, invitaciones y mensajes.
        self.db.delete(servidor)
        self.db.flush()
