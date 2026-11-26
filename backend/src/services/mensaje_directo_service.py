from sqlalchemy.orm import Session

from src.db.models.mensaje_directo_model import MensajeDirecto
from src.db.models.usuario_model import Usuario
from src.dtos.social_dto import ConversacionDTO, CreateMensajeDirectoDTO, MensajeDirectoResponseDTO
from src.mappers.social_mapper import to_mensaje_directo_response, to_usuario_resumen
from src.repositories.mensaje_directo_repository import MensajeDirectoRepository
from src.repositories.miembro_repository import MiembroRepository
from src.repositories.usuario_repository import UsuarioRepository
from src.services.amistad_service import AmistadService
from src.services.archivo_service import ArchivoService
from src.services.mensaje_service import MensajeService
from src.services.notificacion_service import NotificacionService
from src.utils.errors import ForbiddenError, NotFoundError, UnprocessableError


class MensajeDirectoService:
    """Mensajes directos entre dos usuarios.

    Regla: le podés escribir a tus amigos y a la gente con la que compartís
    algún servidor (como en Discord). El historial se puede leer siempre.
    """

    def __init__(self, db: Session):
        self.db = db
        self.mensajes = MensajeDirectoRepository(db)
        self.usuarios = UsuarioRepository(db)
        self.miembros = MiembroRepository(db)
        self.amistades = AmistadService(db)

    def conversaciones(self, actual_id: int) -> list[ConversacionDTO]:
        """Primero las fijadas (en el orden elegido), después el resto por la más reciente."""
        no_leidos = self.mensajes.no_leidos_por_remitente(actual_id)
        fijados = self.mensajes.fijados(actual_id)
        ultimos: dict[int, ConversacionDTO] = {}
        for m in self.mensajes.ultimos_por_conversacion(actual_id):
            otro_id = m.destinatario_id if m.remitente_id == actual_id else m.remitente_id
            otro = self.usuarios.find_by_id(otro_id)
            autor = otro if m.remitente_id == otro_id else self.usuarios.find_by_id(actual_id)
            ultimos[otro_id] = ConversacionDTO(
                usuario=to_usuario_resumen(otro),
                ultimo_mensaje=to_mensaje_directo_response(m, autor),
                no_leidos=no_leidos.get(otro_id, 0),
            )
        resultado = []
        for otro_id in fijados:
            conversacion = ultimos.pop(otro_id, None)
            if conversacion is None:
                otro = self.usuarios.find_by_id(otro_id)
                if otro is None:
                    continue
                conversacion = ConversacionDTO(usuario=to_usuario_resumen(otro), ultimo_mensaje=None, no_leidos=0)
            conversacion.fijada = True
            resultado.append(conversacion)
        return resultado + list(ultimos.values())

    def fijar(self, usuario_ids: list[int], actual_id: int) -> list[ConversacionDTO]:
        """Reemplaza la lista de conversaciones fijadas (y su orden)."""
        ids = list(dict.fromkeys(usuario_ids))
        if actual_id in ids:
            raise UnprocessableError("No te podés fijar a vos mismo")
        if any(self.usuarios.find_by_id(i) is None for i in ids):
            raise NotFoundError("Usuario no encontrado")
        self.mensajes.reemplazar_fijados(actual_id, ids)
        self.db.commit()
        return self.conversaciones(actual_id)

    def listar(
        self, otro_id: int, actual_id: int, limite: int = 50, antes_de: int | None = None
    ) -> list[MensajeDirectoResponseDTO]:
        otro = self._buscar_usuario_o_404(otro_id)
        yo = self.usuarios.find_by_id(actual_id)
        # Al abrir la conversación, lo que me mandaron queda como leído (y su aviso también).
        self.mensajes.marcar_leidos(actual_id, otro.id)
        NotificacionService(self.db).leer_directos_de(actual_id, otro.id)
        self.db.commit()
        autores = {otro.id: otro, yo.id: yo}
        return [
            to_mensaje_directo_response(m, autores[m.remitente_id])
            for m in self.mensajes.list_conversacion(actual_id, otro.id, limite, antes_de)
        ]

    def puede_escribir(self, actual_id: int, otro_id: int) -> bool:
        return self.amistades.son_amigos(actual_id, otro_id) or self.miembros.servidores_en_comun(actual_id, otro_id) > 0

    def enviar(self, otro_id: int, dto: CreateMensajeDirectoDTO, actual_id: int) -> MensajeDirectoResponseDTO:
        otro = self._buscar_usuario_o_404(otro_id)
        if otro.id == actual_id:
            raise UnprocessableError("No te podés mandar mensajes a vos mismo")
        if not self.puede_escribir(actual_id, otro.id):
            raise ForbiddenError("Solo podés escribirle a tus amigos o a gente de tus servidores")

        adjunto = ArchivoService.validar_adjunto(dto.adjunto)
        contenido = MensajeService._validar_contenido(dto.contenido, permitir_vacio=adjunto is not None)
        mensaje = self.mensajes.create(actual_id, otro.id, contenido, adjunto)
        yo = self.usuarios.find_by_id(actual_id)
        NotificacionService(self.db).notificar_mensaje_directo(yo, otro.id, contenido)
        self.db.commit()
        return to_mensaje_directo_response(mensaje, yo)

    def editar(self, mensaje_id: int, contenido: str, actual_id: int) -> MensajeDirectoResponseDTO:
        mensaje = self._buscar_propio(mensaje_id, actual_id, "editar")
        contenido = MensajeService._validar_contenido(contenido, permitir_vacio=mensaje.adjunto_url is not None)
        self.mensajes.update(mensaje, contenido=contenido, editado=True)
        self.db.commit()
        return to_mensaje_directo_response(mensaje, self.usuarios.find_by_id(actual_id))

    def borrar(self, mensaje_id: int, actual_id: int) -> None:
        mensaje = self._buscar_propio(mensaje_id, actual_id, "borrar")
        self.mensajes.delete(mensaje)
        self.db.commit()

    # ---------- Ayudas internas ----------
    def _buscar_usuario_o_404(self, usuario_id: int) -> Usuario:
        usuario = self.usuarios.find_by_id(usuario_id)
        if usuario is None:
            raise NotFoundError("Usuario no encontrado")
        return usuario

    def _buscar_propio(self, mensaje_id: int, actual_id: int, accion: str) -> MensajeDirecto:
        mensaje = self.mensajes.find_by_id(mensaje_id)
        if mensaje is None or actual_id not in (mensaje.remitente_id, mensaje.destinatario_id):
            raise NotFoundError("Mensaje no encontrado")
        if mensaje.remitente_id != actual_id:
            raise ForbiddenError(f"Solo podés {accion} tus propios mensajes")
        return mensaje
