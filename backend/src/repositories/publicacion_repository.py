from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.db.models.estado_model import Estado
from src.db.models.publicacion_model import Publicacion, PublicacionComentario, PublicacionLike
from src.db.models.usuario_model import Usuario


class PublicacionRepository:
    """Consultas a publicaciones, likes, comentarios y estados. Hace flush; el service confirma."""

    def __init__(self, db: Session):
        self.db = db

    # ---------- Publicaciones ----------
    def create(self, autor_id: int, contenido: str, imagen_url: str | None, servidor_id: int | None) -> Publicacion:
        p = Publicacion(autor_id=autor_id, contenido=contenido, imagen_url=imagen_url, servidor_id=servidor_id)
        self.db.add(p)
        self.db.flush()
        return p

    def find_by_id(self, publicacion_id: int) -> Publicacion | None:
        return self.db.query(Publicacion).filter(Publicacion.id == publicacion_id).first()

    def _listar(self, filtro, antes_de: int | None, limite: int) -> list[tuple[Publicacion, Usuario]]:
        consulta = self.db.query(Publicacion, Usuario).join(Usuario, Usuario.id == Publicacion.autor_id).filter(filtro)
        if antes_de is not None:
            consulta = consulta.filter(Publicacion.id < antes_de)
        return consulta.order_by(Publicacion.id.desc()).limit(limite).all()

    def de_perfiles(self, autor_ids: list[int], antes_de: int | None, limite: int):
        """Publicaciones de perfil (no de servidores) de esos usuarios."""
        if not autor_ids:
            return []
        return self._listar(
            Publicacion.autor_id.in_(autor_ids) & Publicacion.servidor_id.is_(None), antes_de, limite
        )

    def de_servidor(self, servidor_id: int, antes_de: int | None, limite: int):
        return self._listar(Publicacion.servidor_id == servidor_id, antes_de, limite)

    def delete(self, publicacion: Publicacion) -> None:
        self.db.delete(publicacion)
        self.db.flush()

    # ---------- Likes ----------
    def find_like(self, publicacion_id: int, usuario_id: int) -> PublicacionLike | None:
        return (
            self.db.query(PublicacionLike)
            .filter(PublicacionLike.publicacion_id == publicacion_id, PublicacionLike.usuario_id == usuario_id)
            .first()
        )

    def agregar_like(self, publicacion_id: int, usuario_id: int) -> None:
        self.db.add(PublicacionLike(publicacion_id=publicacion_id, usuario_id=usuario_id))
        self.db.flush()

    def quitar_like(self, like: PublicacionLike) -> None:
        self.db.delete(like)
        self.db.flush()

    def likes_por_publicacion(self, ids: list[int]) -> dict[int, int]:
        if not ids:
            return {}
        filas = (
            self.db.query(PublicacionLike.publicacion_id, func.count())
            .filter(PublicacionLike.publicacion_id.in_(ids))
            .group_by(PublicacionLike.publicacion_id)
            .all()
        )
        return dict(filas)

    def con_mi_like(self, ids: list[int], usuario_id: int) -> set[int]:
        if not ids:
            return set()
        filas = (
            self.db.query(PublicacionLike.publicacion_id)
            .filter(PublicacionLike.publicacion_id.in_(ids), PublicacionLike.usuario_id == usuario_id)
            .all()
        )
        return {i for (i,) in filas}

    # ---------- Comentarios ----------
    def comentarios_por_publicacion(self, ids: list[int]) -> dict[int, int]:
        if not ids:
            return {}
        filas = (
            self.db.query(PublicacionComentario.publicacion_id, func.count())
            .filter(PublicacionComentario.publicacion_id.in_(ids))
            .group_by(PublicacionComentario.publicacion_id)
            .all()
        )
        return dict(filas)

    def comentarios(self, publicacion_id: int) -> list[tuple[PublicacionComentario, Usuario]]:
        return (
            self.db.query(PublicacionComentario, Usuario)
            .join(Usuario, Usuario.id == PublicacionComentario.autor_id)
            .filter(PublicacionComentario.publicacion_id == publicacion_id)
            .order_by(PublicacionComentario.id)
            .all()
        )

    def agregar_comentario(self, publicacion_id: int, autor_id: int, contenido: str) -> PublicacionComentario:
        c = PublicacionComentario(publicacion_id=publicacion_id, autor_id=autor_id, contenido=contenido)
        self.db.add(c)
        self.db.flush()
        return c

    def find_comentario(self, comentario_id: int) -> PublicacionComentario | None:
        return self.db.query(PublicacionComentario).filter(PublicacionComentario.id == comentario_id).first()

    def borrar_comentario(self, comentario: PublicacionComentario) -> None:
        self.db.delete(comentario)
        self.db.flush()

    # ---------- Estados (duran 24 horas) ----------
    def crear_estado(self, usuario_id: int, contenido: str, imagen_url: str | None, color: str, vence: datetime) -> Estado:
        e = Estado(usuario_id=usuario_id, contenido=contenido, imagen_url=imagen_url, color_fondo=color, vence=vence)
        self.db.add(e)
        self.db.flush()
        return e

    def estados_activos(self, usuario_ids: list[int], ahora: datetime) -> list[Estado]:
        if not usuario_ids:
            return []
        return (
            self.db.query(Estado)
            .filter(Estado.usuario_id.in_(usuario_ids), Estado.vence > ahora)
            .order_by(Estado.fecha)
            .all()
        )

    def contar_activos(self, usuario_id: int, ahora: datetime) -> int:
        return self.db.query(Estado).filter(Estado.usuario_id == usuario_id, Estado.vence > ahora).count()

    def find_estado(self, estado_id: int) -> Estado | None:
        return self.db.query(Estado).filter(Estado.id == estado_id).first()

    def borrar_estado(self, estado: Estado) -> None:
        self.db.delete(estado)
        self.db.flush()

    def borrar_estados_vencidos(self, ahora: datetime) -> int:
        cantidad = self.db.query(Estado).filter(Estado.vence <= ahora).delete(synchronize_session=False)
        self.db.flush()
        return cantidad
