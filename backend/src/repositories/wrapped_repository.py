"""Consultas para el Kort Wrapped (resumen del año de un usuario).

Todas reciben el rango [desde, hasta) del año pedido.
"""

from datetime import date, datetime

from sqlalchemy import and_, extract, func, or_
from sqlalchemy.orm import Session

from src.db.models.amistad_model import Amistad
from src.db.models.canal_model import Canal
from src.db.models.evento_model import Evento, EventoAsistente
from src.db.models.historial_model import HistorialServidor
from src.db.models.mensaje_directo_model import MensajeDirecto
from src.db.models.mensaje_model import Mensaje
from src.db.models.publicacion_model import Publicacion, PublicacionLike
from src.db.models.punto_model import Punto
from src.db.models.reaccion_model import Reaccion
from src.db.models.servidor_model import Servidor
from src.db.models.tarea_model import Tarea
from src.db.models.usuario_model import Usuario


class WrappedRepository:
    def __init__(self, db: Session):
        self.db = db

    def _mis_mensajes(self, usuario_id: int, desde: datetime, hasta: datetime):
        return self.db.query(Mensaje).filter(
            Mensaje.autor_id == usuario_id, Mensaje.fecha >= desde, Mensaje.fecha < hasta
        )

    def total_mensajes(self, usuario_id: int, desde, hasta) -> int:
        return self._mis_mensajes(usuario_id, desde, hasta).count()

    def total_palabras(self, usuario_id: int, desde, hasta) -> int:
        """Cuenta palabras separando por espacios (función de PostgreSQL)."""
        palabras = func.coalesce(
            func.array_length(func.regexp_split_to_array(func.btrim(Mensaje.contenido), r"\s+"), 1), 0
        )
        total = (
            self.db.query(func.coalesce(func.sum(palabras), 0))
            .filter(Mensaje.autor_id == usuario_id, Mensaje.fecha >= desde, Mensaje.fecha < hasta, Mensaje.contenido != "")
            .scalar()
        )
        return int(total or 0)

    def total_directos(self, usuario_id: int, desde, hasta) -> int:
        return (
            self.db.query(MensajeDirecto)
            .filter(MensajeDirecto.remitente_id == usuario_id, MensajeDirecto.fecha >= desde, MensajeDirecto.fecha < hasta)
            .count()
        )

    def canal_favorito(self, usuario_id: int, desde, hasta):
        """(canal, servidor, cantidad) donde más escribió, o None."""
        return (
            self.db.query(Canal.nombre, Servidor.nombre, func.count(Mensaje.id).label("n"))
            .join(Canal, Canal.id == Mensaje.canal_id)
            .join(Servidor, Servidor.id == Canal.servidor_id)
            .filter(Mensaje.autor_id == usuario_id, Mensaje.fecha >= desde, Mensaje.fecha < hasta)
            .group_by(Canal.id, Canal.nombre, Servidor.nombre)
            .order_by(func.count(Mensaje.id).desc())
            .first()
        )

    def servidores_mas_activos(self, usuario_id: int, desde, hasta, limite: int = 3):
        return (
            self.db.query(Servidor.nombre, func.count(Mensaje.id))
            .join(Canal, Canal.id == Mensaje.canal_id)
            .join(Servidor, Servidor.id == Canal.servidor_id)
            .filter(Mensaje.autor_id == usuario_id, Mensaje.fecha >= desde, Mensaje.fecha < hasta)
            .group_by(Servidor.id, Servidor.nombre)
            .order_by(func.count(Mensaje.id).desc())
            .limit(limite)
            .all()
        )

    def por_hora(self, usuario_id: int, desde, hasta) -> dict[int, int]:
        hora = extract("hour", Mensaje.fecha)
        filas = (
            self.db.query(hora, func.count())
            .filter(Mensaje.autor_id == usuario_id, Mensaje.fecha >= desde, Mensaje.fecha < hasta)
            .group_by(hora)
            .all()
        )
        return {int(h): n for h, n in filas}

    def por_dia_de_semana(self, usuario_id: int, desde, hasta) -> dict[int, int]:
        """0 = lunes ... 6 = domingo (isodow de PostgreSQL menos 1)."""
        dia = extract("isodow", Mensaje.fecha)
        filas = (
            self.db.query(dia, func.count())
            .filter(Mensaje.autor_id == usuario_id, Mensaje.fecha >= desde, Mensaje.fecha < hasta)
            .group_by(dia)
            .all()
        )
        return {int(d) - 1: n for d, n in filas}

    def por_mes(self, usuario_id: int, desde, hasta) -> dict[int, int]:
        mes = extract("month", Mensaje.fecha)
        filas = (
            self.db.query(mes, func.count())
            .filter(Mensaje.autor_id == usuario_id, Mensaje.fecha >= desde, Mensaje.fecha < hasta)
            .group_by(mes)
            .all()
        )
        return {int(m): n for m, n in filas}

    def dias_con_mensajes(self, usuario_id: int, desde, hasta) -> list[date]:
        dia = func.date(Mensaje.fecha)
        filas = (
            self.db.query(dia)
            .filter(Mensaje.autor_id == usuario_id, Mensaje.fecha >= desde, Mensaje.fecha < hasta)
            .distinct()
            .order_by(dia)
            .all()
        )
        return [d for (d,) in filas]

    def emojis_favoritos(self, usuario_id: int, desde, hasta, limite: int = 5):
        return (
            self.db.query(Reaccion.emoji, func.count())
            .filter(Reaccion.usuario_id == usuario_id, Reaccion.fecha >= desde, Reaccion.fecha < hasta)
            .group_by(Reaccion.emoji)
            .order_by(func.count().desc())
            .limit(limite)
            .all()
        )

    def reacciones_recibidas(self, usuario_id: int, desde, hasta) -> int:
        return (
            self.db.query(Reaccion)
            .join(Mensaje, Mensaje.id == Reaccion.mensaje_id)
            .filter(
                Mensaje.autor_id == usuario_id,
                Reaccion.usuario_id != usuario_id,
                Reaccion.fecha >= desde,
                Reaccion.fecha < hasta,
            )
            .count()
        )

    def persona_mas_hablada(self, usuario_id: int, desde, hasta):
        """(Usuario, cantidad de mensajes directos intercambiados) o None."""
        otro = func.coalesce(
            func.nullif(MensajeDirecto.remitente_id, usuario_id), MensajeDirecto.destinatario_id
        )
        fila = (
            self.db.query(otro.label("otro"), func.count().label("n"))
            .filter(
                or_(MensajeDirecto.remitente_id == usuario_id, MensajeDirecto.destinatario_id == usuario_id),
                MensajeDirecto.fecha >= desde,
                MensajeDirecto.fecha < hasta,
            )
            .group_by(otro)
            .order_by(func.count().desc())
            .first()
        )
        if fila is None:
            return None
        return self.db.query(Usuario).filter(Usuario.id == fila.otro).first(), fila.n

    def amigos_nuevos(self, usuario_id: int, desde, hasta) -> int:
        return (
            self.db.query(Amistad)
            .filter(
                Amistad.estado == "aceptada",
                or_(Amistad.solicitante_id == usuario_id, Amistad.receptor_id == usuario_id),
                func.coalesce(Amistad.fecha_respuesta, Amistad.fecha) >= desde,
                func.coalesce(Amistad.fecha_respuesta, Amistad.fecha) < hasta,
            )
            .count()
        )

    def servidores_nuevos(self, usuario_id: int, desde, hasta) -> int:
        return (
            self.db.query(HistorialServidor)
            .filter(
                HistorialServidor.usuario_id == usuario_id,
                HistorialServidor.fecha_union >= desde,
                HistorialServidor.fecha_union < hasta,
            )
            .count()
        )

    def publicaciones(self, usuario_id: int, desde, hasta) -> int:
        return (
            self.db.query(Publicacion)
            .filter(Publicacion.autor_id == usuario_id, Publicacion.fecha >= desde, Publicacion.fecha < hasta)
            .count()
        )

    def likes_recibidos(self, usuario_id: int, desde, hasta) -> int:
        return (
            self.db.query(PublicacionLike)
            .join(Publicacion, Publicacion.id == PublicacionLike.publicacion_id)
            .filter(Publicacion.autor_id == usuario_id, Publicacion.fecha >= desde, Publicacion.fecha < hasta)
            .count()
        )

    def tareas_completadas(self, usuario_id: int, desde, hasta) -> int:
        return (
            self.db.query(Tarea)
            .filter(
                Tarea.asignado_id == usuario_id,
                Tarea.estado == "hecha",
                Tarea.fecha_completada >= desde,
                Tarea.fecha_completada < hasta,
            )
            .count()
        )

    def eventos_asistidos(self, usuario_id: int, desde, hasta) -> int:
        return (
            self.db.query(EventoAsistente)
            .join(Evento, Evento.id == EventoAsistente.evento_id)
            .filter(and_(EventoAsistente.usuario_id == usuario_id, Evento.inicio >= desde, Evento.inicio < hasta))
            .count()
        )

    def puntos_ganados(self, usuario_id: int, desde, hasta) -> int:
        total = (
            self.db.query(func.coalesce(func.sum(Punto.cantidad), 0))
            .filter(Punto.usuario_id == usuario_id, Punto.fecha >= desde, Punto.fecha < hasta)
            .scalar()
        )
        return int(total or 0)
