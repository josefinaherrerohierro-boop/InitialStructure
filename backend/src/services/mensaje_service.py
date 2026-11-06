from sqlalchemy.orm import Session

from src.db.models.canal_model import Canal
from src.db.models.mensaje_model import LARGO_MAXIMO_MENSAJE, Mensaje
from src.dtos.mensaje_dto import CreateMensajeDTO, MensajeResponseDTO, UpdateMensajeDTO
from src.mappers.mensaje_mapper import to_mensaje_response
from src.repositories.canal_repository import CanalRepository
from src.repositories.mensaje_repository import MensajeRepository
from src.repositories.usuario_repository import UsuarioRepository
from src.services.permisos_service import PermisosService
from src.utils.errors import ForbiddenError, NotFoundError, UnprocessableError

LIMITE_POR_DEFECTO = 50


class MensajeService:
    """Reglas de negocio de los mensajes (HU7, HU8)."""

    def __init__(self, db: Session):
        self.db = db
        self.mensajes = MensajeRepository(db)
        self.canales = CanalRepository(db)
        self.usuarios = UsuarioRepository(db)
        self.permisos = PermisosService(db)

    # ---------- HU7: enviar mensaje ----------
    def enviar(self, canal_id: int, dto: CreateMensajeDTO, actual_id: int) -> MensajeResponseDTO:
        canal = self._buscar_canal_o_404(canal_id)
        servidor = self.permisos.obtener_servidor(canal.servidor_id)

        # 1. Solo se escribe en canales de texto.
        if canal.tipo != "texto":
            raise UnprocessableError("No se pueden enviar mensajes en un canal de voz")
        # 2. El autor tiene que ser miembro del servidor del canal.
        self.permisos.exigir_miembro(servidor.id, actual_id)
        # 3. Hace falta al menos un rol con puede_escribir = true.
        if not self.permisos.puede_escribir(servidor.id, actual_id):
            raise ForbiddenError("No tenés permiso para escribir en este servidor")
        # 4. En canales de solo lectura solo escriben moderadores y el dueño.
        if canal.solo_lectura and not self.permisos.es_moderador(servidor, actual_id):
            raise ForbiddenError("Este canal es de solo lectura")
        # 5. Contenido válido (no vacío, máximo 2000 caracteres).
        contenido = self._validar_contenido(dto.contenido)

        mensaje = self.mensajes.create(canal_id=canal.id, autor_id=actual_id, contenido=contenido)
        self.db.commit()
        return to_mensaje_response(mensaje, self.usuarios.find_by_id(actual_id))

    # ---------- HU8: listar mensajes con paginación ----------
    def listar(
        self, canal_id: int, actual_id: int, limite: int = LIMITE_POR_DEFECTO, antes_de: int | None = None
    ) -> list[MensajeResponseDTO]:
        canal = self._buscar_canal_o_404(canal_id)
        self.permisos.exigir_miembro(canal.servidor_id, actual_id)
        filas = self.mensajes.list_by_canal(canal.id, limite=limite, antes_de=antes_de)
        return [to_mensaje_response(mensaje, autor) for mensaje, autor in filas]

    # ---------- HU8: editar (solo el autor) ----------
    def editar(self, mensaje_id: int, dto: UpdateMensajeDTO, actual_id: int) -> MensajeResponseDTO:
        mensaje = self._buscar_mensaje_o_404(mensaje_id)
        canal = self._buscar_canal_o_404(mensaje.canal_id)

        if mensaje.autor_id != actual_id:
            raise ForbiddenError("Solo el autor puede editar su mensaje")
        self.permisos.exigir_miembro(canal.servidor_id, actual_id)

        contenido = self._validar_contenido(dto.contenido)
        self.mensajes.update(mensaje, contenido=contenido, editado=True)
        self.db.commit()
        return to_mensaje_response(mensaje, self.usuarios.find_by_id(actual_id))

    # ---------- HU8: borrar (autor o moderador) ----------
    def borrar(self, mensaje_id: int, actual_id: int) -> None:
        mensaje = self._buscar_mensaje_o_404(mensaje_id)
        canal = self._buscar_canal_o_404(mensaje.canal_id)
        servidor = self.permisos.obtener_servidor(canal.servidor_id)

        es_autor = mensaje.autor_id == actual_id
        if not es_autor and not self.permisos.es_moderador(servidor, actual_id):
            raise ForbiddenError("Solo el autor o un moderador pueden borrar este mensaje")

        self.mensajes.delete(mensaje)
        self.db.commit()

    # ---------- Ayudas internas ----------
    @staticmethod
    def _validar_contenido(contenido: str) -> str:
        contenido = contenido.strip()
        if not contenido:
            raise UnprocessableError("El mensaje no puede estar vacío")
        if len(contenido) > LARGO_MAXIMO_MENSAJE:
            raise UnprocessableError("El mensaje no puede superar los 2000 caracteres")
        return contenido

    def _buscar_canal_o_404(self, canal_id: int) -> Canal:
        canal = self.canales.find_by_id(canal_id)
        if canal is None:
            raise NotFoundError("Canal no encontrado")
        return canal

    def _buscar_mensaje_o_404(self, mensaje_id: int) -> Mensaje:
        mensaje = self.mensajes.find_by_id(mensaje_id)
        if mensaje is None:
            raise NotFoundError("Mensaje no encontrado")
        return mensaje
