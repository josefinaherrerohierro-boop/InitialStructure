"""Consultas del calendario, las tareas y el scoreboard. Hacen flush; el service confirma."""

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.db.models.canal_model import Canal
from src.db.models.evento_model import Evento, EventoAsistente
from src.db.models.mensaje_model import Mensaje
from src.db.models.punto_model import Punto
from src.db.models.tarea_model import Tarea


class EventoRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, **campos) -> Evento:
        evento = Evento(**campos)
        self.db.add(evento)
        self.db.flush()
        return evento

    def find_by_id(self, evento_id: int) -> Evento | None:
        return self.db.query(Evento).filter(Evento.id == evento_id).first()

    def list_entre(self, servidor_id: int, desde: datetime, hasta: datetime) -> list[Evento]:
        """Eventos que se cruzan con el rango [desde, hasta)."""
        termina = func.coalesce(Evento.fin, Evento.inicio)
        return (
            self.db.query(Evento)
            .filter(Evento.servidor_id == servidor_id, Evento.inicio < hasta, termina >= desde)
            .order_by(Evento.inicio)
            .all()
        )

    def update(self, evento: Evento, **campos) -> Evento:
        for nombre, valor in campos.items():
            setattr(evento, nombre, valor)
        self.db.flush()
        return evento

    def delete(self, evento: Evento) -> None:
        self.db.delete(evento)
        self.db.flush()

    def asistentes(self, evento_ids: list[int]) -> list[EventoAsistente]:
        if not evento_ids:
            return []
        return self.db.query(EventoAsistente).filter(EventoAsistente.evento_id.in_(evento_ids)).all()

    def find_asistencia(self, evento_id: int, usuario_id: int) -> EventoAsistente | None:
        return (
            self.db.query(EventoAsistente)
            .filter(EventoAsistente.evento_id == evento_id, EventoAsistente.usuario_id == usuario_id)
            .first()
        )

    def agregar_asistente(self, evento_id: int, usuario_id: int) -> None:
        self.db.add(EventoAsistente(evento_id=evento_id, usuario_id=usuario_id))
        self.db.flush()

    def quitar_asistente(self, asistencia: EventoAsistente) -> None:
        self.db.delete(asistencia)
        self.db.flush()


class TareaRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, **campos) -> Tarea:
        tarea = Tarea(**campos)
        self.db.add(tarea)
        self.db.flush()
        return tarea

    def find_by_id(self, tarea_id: int) -> Tarea | None:
        return self.db.query(Tarea).filter(Tarea.id == tarea_id).first()

    def list_by_servidor(self, servidor_id: int, asignado_id: int | None = None) -> list[Tarea]:
        consulta = self.db.query(Tarea).filter(Tarea.servidor_id == servidor_id)
        if asignado_id is not None:
            consulta = consulta.filter(Tarea.asignado_id == asignado_id)
        # Primero las que tienen fecha límite más cercana; las sin fecha al final.
        return consulta.order_by(Tarea.fecha_limite.is_(None), Tarea.fecha_limite, Tarea.id).all()

    def update(self, tarea: Tarea, **campos) -> Tarea:
        for nombre, valor in campos.items():
            setattr(tarea, nombre, valor)
        self.db.flush()
        return tarea

    def delete(self, tarea: Tarea) -> None:
        self.db.delete(tarea)
        self.db.flush()

    def hechas_por_usuario(self, servidor_id: int) -> dict[int, int]:
        filas = (
            self.db.query(Tarea.asignado_id, func.count())
            .filter(Tarea.servidor_id == servidor_id, Tarea.estado == "hecha", Tarea.asignado_id.isnot(None))
            .group_by(Tarea.asignado_id)
            .all()
        )
        return dict(filas)


class PuntoRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, servidor_id: int, usuario_id: int, cantidad: int, motivo: str, otorgado_por: int | None) -> Punto:
        punto = Punto(
            servidor_id=servidor_id, usuario_id=usuario_id, cantidad=cantidad, motivo=motivo, otorgado_por=otorgado_por
        )
        self.db.add(punto)
        self.db.flush()
        return punto

    def totales(self, servidor_id: int) -> dict[int, int]:
        filas = (
            self.db.query(Punto.usuario_id, func.sum(Punto.cantidad))
            .filter(Punto.servidor_id == servidor_id)
            .group_by(Punto.usuario_id)
            .all()
        )
        return {u: int(total) for u, total in filas}

    def recientes(self, servidor_id: int, limite: int = 30) -> list[Punto]:
        return (
            self.db.query(Punto)
            .filter(Punto.servidor_id == servidor_id)
            .order_by(Punto.id.desc())
            .limit(limite)
            .all()
        )

    def mensajes_desde(self, servidor_id: int, desde: datetime) -> dict[int, int]:
        """Mensajes por autor en el servidor desde una fecha (actividad del scoreboard)."""
        filas = (
            self.db.query(Mensaje.autor_id, func.count())
            .join(Canal, Canal.id == Mensaje.canal_id)
            .filter(Canal.servidor_id == servidor_id, Mensaje.fecha >= desde)
            .group_by(Mensaje.autor_id)
            .all()
        )
        return dict(filas)

