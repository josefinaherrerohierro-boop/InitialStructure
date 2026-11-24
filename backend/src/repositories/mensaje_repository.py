from sqlalchemy import or_
from sqlalchemy.orm import Session

from src.db.models.canal_model import Canal
from src.db.models.mensaje_model import Mensaje
from src.db.models.usuario_model import Usuario


def escapar_like(texto: str) -> str:
    """Escapa los comodines de LIKE (% y _) para buscar el texto tal cual."""
    return texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class MensajeRepository:
    """Consultas a la tabla `mensajes`. Hace flush; el service confirma (commit)."""

    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        canal_id: int,
        autor_id: int,
        contenido: str,
        adjunto_url: str | None = None,
        adjunto_tipo: str | None = None,
        adjunto_nombre: str | None = None,
    ) -> Mensaje:
        mensaje = Mensaje(
            canal_id=canal_id,
            autor_id=autor_id,
            contenido=contenido,
            editado=False,
            fijado=False,
            adjunto_url=adjunto_url,
            adjunto_tipo=adjunto_tipo,
            adjunto_nombre=adjunto_nombre,
        )
        self.db.add(mensaje)
        self.db.flush()
        return mensaje

    def find_by_id(self, mensaje_id: int) -> Mensaje | None:
        return self.db.query(Mensaje).filter(Mensaje.id == mensaje_id).first()

    def _con_autor(self):
        return self.db.query(Mensaje, Usuario).join(Usuario, Usuario.id == Mensaje.autor_id)

    def list_by_canal(
        self, canal_id: int, limite: int, antes_de: int | None = None
    ) -> list[tuple[Mensaje, Usuario]]:
        """Paginación por id (HU8): los `limite` mensajes más recientes cuyo id
        sea menor a `antes_de`. Se devuelven del más viejo al más nuevo, que es
        el orden en que se muestran en un chat."""
        consulta = self._con_autor().filter(Mensaje.canal_id == canal_id)
        if antes_de is not None:
            consulta = consulta.filter(Mensaje.id < antes_de)

        recientes = consulta.order_by(Mensaje.id.desc()).limit(limite).all()
        return list(reversed(recientes))

    def find_con_autor(self, mensaje_id: int) -> tuple[Mensaje, Usuario] | None:
        return self._con_autor().filter(Mensaje.id == mensaje_id).first()

    # ---------- Mensajes fijados ----------
    def list_fijados(self, canal_id: int) -> list[tuple[Mensaje, Usuario]]:
        return (
            self._con_autor()
            .filter(Mensaje.canal_id == canal_id, Mensaje.fijado.is_(True))
            .order_by(Mensaje.id.desc())
            .all()
        )

    def contar_fijados(self, canal_id: int) -> int:
        return self.db.query(Mensaje).filter(Mensaje.canal_id == canal_id, Mensaje.fijado.is_(True)).count()

    # ---------- Búsqueda ----------
    def buscar(
        self,
        servidor_id: int,
        texto: str,
        canal_id: int | None,
        autor_id: int | None,
        limite: int,
    ) -> list[tuple[Mensaje, Usuario]]:
        """Mensajes del servidor que contienen `texto` (sin distinguir mayúsculas),
        del más nuevo al más viejo."""
        consulta = (
            self._con_autor()
            .join(Canal, Canal.id == Mensaje.canal_id)
            .filter(Canal.servidor_id == servidor_id)
            .filter(Mensaje.contenido.ilike(f"%{escapar_like(texto)}%", escape="\\"))
        )
        if canal_id is not None:
            consulta = consulta.filter(Mensaje.canal_id == canal_id)
        if autor_id is not None:
            consulta = consulta.filter(Mensaje.autor_id == autor_id)
        return consulta.order_by(Mensaje.id.desc()).limit(limite).all()

    # ---------- Sección de multimedia ----------
    def multimedia(
        self, servidor_id: int, tipo: str, antes_de: int | None, limite: int
    ) -> list[tuple[Mensaje, Usuario]]:
        """Mensajes del servidor con imágenes, videos, audios, archivos o links."""
        consulta = (
            self._con_autor()
            .join(Canal, Canal.id == Mensaje.canal_id)
            .filter(Canal.servidor_id == servidor_id)
        )
        if tipo == "link":
            consulta = consulta.filter(
                or_(Mensaje.contenido.ilike("%http://%"), Mensaje.contenido.ilike("%https://%"))
            )
        else:
            consulta = consulta.filter(Mensaje.adjunto_tipo == tipo)
        if antes_de is not None:
            consulta = consulta.filter(Mensaje.id < antes_de)
        return consulta.order_by(Mensaje.id.desc()).limit(limite).all()

    def update(self, mensaje: Mensaje, **campos) -> Mensaje:
        for nombre, valor in campos.items():
            setattr(mensaje, nombre, valor)
        self.db.flush()
        return mensaje

    def delete(self, mensaje: Mensaje) -> None:
        self.db.delete(mensaje)
        self.db.flush()
