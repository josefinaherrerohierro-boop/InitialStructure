from datetime import datetime

from sqlalchemy.orm import Session

from src.db.models.encuesta_model import Encuesta, OpcionEncuesta, VotoEncuesta


class EncuestaRepository:
    """Consultas a encuestas, opciones y votos. Hace flush; el service confirma."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, mensaje_id: int, multiple: bool, fecha_limite: datetime | None) -> Encuesta:
        encuesta = Encuesta(mensaje_id=mensaje_id, multiple=multiple, fecha_limite=fecha_limite)
        self.db.add(encuesta)
        self.db.flush()
        return encuesta

    def agregar_opcion(self, encuesta_id: int, texto: str, orden: int) -> OpcionEncuesta:
        opcion = OpcionEncuesta(encuesta_id=encuesta_id, texto=texto, orden=orden)
        self.db.add(opcion)
        self.db.flush()
        return opcion

    def find_by_id(self, encuesta_id: int) -> Encuesta | None:
        return self.db.query(Encuesta).filter(Encuesta.id == encuesta_id).first()

    def list_by_mensajes(self, mensaje_ids: list[int]) -> list[Encuesta]:
        if not mensaje_ids:
            return []
        return self.db.query(Encuesta).filter(Encuesta.mensaje_id.in_(mensaje_ids)).all()

    def opciones_de(self, encuesta_ids: list[int]) -> list[OpcionEncuesta]:
        if not encuesta_ids:
            return []
        return (
            self.db.query(OpcionEncuesta)
            .filter(OpcionEncuesta.encuesta_id.in_(encuesta_ids))
            .order_by(OpcionEncuesta.orden, OpcionEncuesta.id)
            .all()
        )

    def votos_de(self, encuesta_ids: list[int]) -> list[VotoEncuesta]:
        if not encuesta_ids:
            return []
        return self.db.query(VotoEncuesta).filter(VotoEncuesta.encuesta_id.in_(encuesta_ids)).all()

    def borrar_votos(self, encuesta_id: int, usuario_id: int) -> None:
        self.db.query(VotoEncuesta).filter(
            VotoEncuesta.encuesta_id == encuesta_id, VotoEncuesta.usuario_id == usuario_id
        ).delete(synchronize_session=False)
        self.db.flush()

    def votar(self, encuesta_id: int, opcion_id: int, usuario_id: int) -> None:
        self.db.add(VotoEncuesta(encuesta_id=encuesta_id, opcion_id=opcion_id, usuario_id=usuario_id))
        self.db.flush()
