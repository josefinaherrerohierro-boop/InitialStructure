from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.db.models.amistad_model import Amistad
from src.dtos.social_dto import AmigoDTO, SolicitudDTO, SolicitudesDTO
from src.mappers.social_mapper import to_usuario_resumen
from src.repositories.amistad_repository import AmistadRepository
from src.repositories.usuario_repository import UsuarioRepository
from src.services.notificacion_service import NotificacionService
from src.utils.errors import ConflictError, ForbiddenError, NotFoundError, UnprocessableError
from src.utils.fechas import ahora


class AmistadService:
    """Agregar amigos: solicitudes, aceptar, rechazar y eliminar."""

    def __init__(self, db: Session):
        self.db = db
        self.amistades = AmistadRepository(db)
        self.usuarios = UsuarioRepository(db)

    # ---------- Consultas ----------
    def amigos(self, actual_id: int) -> list[AmigoDTO]:
        resultado = []
        for a in self.amistades.list_de_usuario(actual_id, "aceptada"):
            otro = self.usuarios.find_by_id(a.otro(actual_id))
            resultado.append(AmigoDTO(usuario=to_usuario_resumen(otro), desde=a.fecha_respuesta or a.fecha))
        return sorted(resultado, key=lambda x: x.usuario.username)

    def solicitudes(self, actual_id: int) -> SolicitudesDTO:
        recibidas, enviadas = [], []
        for a in self.amistades.list_de_usuario(actual_id, "pendiente"):
            dto = SolicitudDTO(id=a.id, usuario=to_usuario_resumen(self.usuarios.find_by_id(a.otro(actual_id))), fecha=a.fecha)
            (recibidas if a.receptor_id == actual_id else enviadas).append(dto)
        return SolicitudesDTO(recibidas=recibidas, enviadas=enviadas)

    def relacion(self, actual_id: int, otro_id: int) -> str:
        """'yo', 'amigos', 'enviada', 'recibida' o 'ninguna'."""
        if actual_id == otro_id:
            return "yo"
        a = self.amistades.find_entre(actual_id, otro_id)
        if a is None:
            return "ninguna"
        if a.estado == "aceptada":
            return "amigos"
        return "enviada" if a.solicitante_id == actual_id else "recibida"

    def son_amigos(self, a: int, b: int) -> bool:
        amistad = self.amistades.find_entre(a, b)
        return amistad is not None and amistad.estado == "aceptada"

    # ---------- Acciones ----------
    def enviar(self, username: str, actual_id: int) -> str:
        """Manda una solicitud. Si la otra persona ya me había mandado una, se
        acepta directamente. Devuelve el estado final: 'enviada' o 'amigos'."""
        otro = self.usuarios.find_by_username(username.strip().lower())
        if otro is None:
            raise NotFoundError("No existe ningún usuario con ese nombre")
        if otro.id == actual_id:
            raise UnprocessableError("No te podés agregar a vos mismo")

        existente = self.amistades.find_entre(actual_id, otro.id)
        if existente is not None:
            if existente.estado == "aceptada":
                raise ConflictError(f"Ya sos amigo de {otro.username}")
            if existente.solicitante_id == actual_id:
                raise ConflictError(f"Ya le mandaste una solicitud a {otro.username}")
            self._aceptar(existente, actual_id)
            return "amigos"

        try:
            self.amistades.create(actual_id, otro.id)
            NotificacionService(self.db).notificar_solicitud(self.usuarios.find_by_id(actual_id), otro.id)
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise ConflictError("Ya hay una solicitud entre ustedes")
        return "enviada"

    def aceptar(self, solicitud_id: int, actual_id: int) -> None:
        solicitud = self._buscar_pendiente(solicitud_id)
        if solicitud.receptor_id != actual_id:
            raise ForbiddenError("Solo quien recibió la solicitud puede aceptarla")
        self._aceptar(solicitud, actual_id)

    def rechazar(self, solicitud_id: int, actual_id: int) -> None:
        """Rechazar una solicitud recibida o cancelar una enviada."""
        solicitud = self._buscar_pendiente(solicitud_id)
        if actual_id not in (solicitud.solicitante_id, solicitud.receptor_id):
            raise ForbiddenError("Esa solicitud no es tuya")
        self.amistades.delete(solicitud)
        self.db.commit()

    def eliminar(self, usuario_id: int, actual_id: int) -> None:
        amistad = self.amistades.find_entre(actual_id, usuario_id)
        if amistad is None or amistad.estado != "aceptada":
            raise NotFoundError("No son amigos")
        self.amistades.delete(amistad)
        self.db.commit()

    # ---------- Ayudas internas ----------
    def _aceptar(self, solicitud: Amistad, quien_acepta_id: int) -> None:
        self.amistades.update(solicitud, estado="aceptada", fecha_respuesta=ahora())
        # Aviso para la otra persona: "Ahora sos amigo de ...".
        NotificacionService(self.db).notificar_amistad_aceptada(
            self.usuarios.find_by_id(quien_acepta_id), solicitud.otro(quien_acepta_id)
        )
        self.db.commit()

    def _buscar_pendiente(self, solicitud_id: int) -> Amistad:
        solicitud = self.amistades.find_by_id(solicitud_id)
        if solicitud is None or solicitud.estado != "pendiente":
            raise NotFoundError("Solicitud no encontrada")
        return solicitud
