"""Arma las respuestas de mensajes con todo lo que se muestra en el chat:
apodo del autor, reacciones y encuesta (si la tiene).

Se hace en "lote" (unas pocas consultas para toda la página de mensajes)
en vez de una consulta por mensaje, para que el chat cargue rápido.
"""

from collections import defaultdict

from sqlalchemy.orm import Session

from src.db.models.encuesta_model import Encuesta, OpcionEncuesta, VotoEncuesta
from src.db.models.mensaje_model import Mensaje
from src.db.models.usuario_model import Usuario
from src.dtos.mensaje_dto import EncuestaDTO, MensajeResponseDTO, OpcionEncuestaDTO, ReaccionResumenDTO
from src.mappers.mensaje_mapper import to_mensaje_response
from src.repositories.encuesta_repository import EncuestaRepository
from src.repositories.miembro_repository import MiembroRepository
from src.repositories.reaccion_repository import ReaccionRepository
from src.utils.fechas import ahora


class ArmadorDeMensajes:
    def __init__(self, db: Session):
        self.reacciones = ReaccionRepository(db)
        self.encuestas = EncuestaRepository(db)
        self.miembros = MiembroRepository(db)

    def armar(
        self, filas: list[tuple[Mensaje, Usuario]], servidor_id: int, actual_id: int
    ) -> list[MensajeResponseDTO]:
        ids = [m.id for m, _ in filas]
        apodos = self.miembros.apodos(servidor_id)
        avatares = self.miembros.avatares(servidor_id)
        reacciones = self._reacciones_por_mensaje(ids)
        encuestas = self._encuestas_por_mensaje(ids, actual_id)
        return [
            to_mensaje_response(
                mensaje,
                autor,
                apodo=apodos.get(autor.id),
                avatar_url=avatares.get(autor.id),
                reacciones=reacciones.get(mensaje.id, []),
                encuesta=encuestas.get(mensaje.id),
            )
            for mensaje, autor in filas
        ]

    def armar_uno(self, mensaje: Mensaje, autor: Usuario, servidor_id: int, actual_id: int) -> MensajeResponseDTO:
        return self.armar([(mensaje, autor)], servidor_id, actual_id)[0]

    # ---------- Ayudas internas ----------
    def _reacciones_por_mensaje(self, ids: list[int]) -> dict[int, list[ReaccionResumenDTO]]:
        # {mensaje_id: {emoji: [usuario_id, ...]}} respetando el orden en que se pusieron.
        agrupadas: dict[int, dict[str, list[int]]] = defaultdict(dict)
        for r in self.reacciones.list_by_mensajes(ids):
            agrupadas[r.mensaje_id].setdefault(r.emoji, []).append(r.usuario_id)
        return {
            mensaje_id: [
                ReaccionResumenDTO(emoji=emoji, cantidad=len(usuarios), usuarios=usuarios)
                for emoji, usuarios in por_emoji.items()
            ]
            for mensaje_id, por_emoji in agrupadas.items()
        }

    def _encuestas_por_mensaje(self, ids: list[int], actual_id: int) -> dict[int, EncuestaDTO]:
        encuestas = self.encuestas.list_by_mensajes(ids)
        if not encuestas:
            return {}
        encuesta_ids = [e.id for e in encuestas]
        opciones: dict[int, list[OpcionEncuesta]] = defaultdict(list)
        for o in self.encuestas.opciones_de(encuesta_ids):
            opciones[o.encuesta_id].append(o)
        votos: dict[int, list[VotoEncuesta]] = defaultdict(list)
        for v in self.encuestas.votos_de(encuesta_ids):
            votos[v.encuesta_id].append(v)
        return {e.mensaje_id: self._encuesta_dto(e, opciones[e.id], votos[e.id], actual_id) for e in encuestas}

    @staticmethod
    def _encuesta_dto(
        encuesta: Encuesta, opciones: list[OpcionEncuesta], votos: list[VotoEncuesta], actual_id: int
    ) -> EncuestaDTO:
        por_opcion: dict[int, int] = defaultdict(int)
        for v in votos:
            por_opcion[v.opcion_id] += 1
        return EncuestaDTO(
            id=encuesta.id,
            multiple=encuesta.multiple,
            fecha_limite=encuesta.fecha_limite,
            cerrada=encuesta.fecha_limite is not None and encuesta.fecha_limite <= ahora(),
            total_votantes=len({v.usuario_id for v in votos}),
            opciones=[OpcionEncuestaDTO(id=o.id, texto=o.texto, votos=por_opcion[o.id]) for o in opciones],
            mis_votos=[v.opcion_id for v in votos if v.usuario_id == actual_id],
        )
