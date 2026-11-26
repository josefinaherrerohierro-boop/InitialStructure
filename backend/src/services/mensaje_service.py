from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.db.models.canal_model import Canal
from src.db.models.mensaje_model import LARGO_MAXIMO_MENSAJE, Mensaje
from src.dtos.mensaje_dto import (
    CreateEncuestaDTO,
    CreateMensajeDTO,
    MensajeResponseDTO,
    UpdateMensajeDTO,
    VotarDTO,
)
from src.repositories.canal_repository import CanalRepository
from src.repositories.encuesta_repository import EncuestaRepository
from src.repositories.mensaje_repository import MensajeRepository
from src.repositories.reaccion_repository import ReaccionRepository
from src.repositories.usuario_repository import UsuarioRepository
from src.services.archivo_service import ArchivoService
from src.services.mensaje_respuestas import ArmadorDeMensajes
from src.services.notificacion_service import NotificacionService
from src.services.permisos_service import PermisosService
from src.utils.errors import ConflictError, ForbiddenError, NotFoundError, UnprocessableError
from src.utils.fechas import a_hora_local, ahora

LIMITE_POR_DEFECTO = 50
MAXIMO_FIJADOS_POR_CANAL = 50
MAXIMO_EMOJIS_POR_MENSAJE = 20
LARGO_MINIMO_BUSQUEDA = 2
TIPOS_MULTIMEDIA = ("imagen", "video", "audio", "archivo", "link")


class MensajeService:
    """Reglas de negocio de los mensajes (HU7, HU8) y de lo que se hace con
    ellos: adjuntos, reacciones, fijados, búsqueda, multimedia y encuestas."""

    def __init__(self, db: Session):
        self.db = db
        self.mensajes = MensajeRepository(db)
        self.canales = CanalRepository(db)
        self.usuarios = UsuarioRepository(db)
        self.reacciones = ReaccionRepository(db)
        self.encuestas = EncuestaRepository(db)
        self.permisos = PermisosService(db)
        self.armador = ArmadorDeMensajes(db)

    # ---------- HU7: enviar mensaje (con texto, un adjunto, o ambos) ----------
    def enviar(self, canal_id: int, dto: CreateMensajeDTO, actual_id: int) -> MensajeResponseDTO:
        canal = self._buscar_canal_o_404(canal_id)
        self._validar_escritura(canal, actual_id)

        adjunto = ArchivoService.validar_adjunto(dto.adjunto)
        contenido = self._validar_contenido(dto.contenido, permitir_vacio=adjunto is not None)

        mensaje = self.mensajes.create(
            canal_id=canal.id,
            autor_id=actual_id,
            contenido=contenido,
            adjunto_url=adjunto.url if adjunto else None,
            adjunto_tipo=adjunto.tipo if adjunto else None,
            adjunto_nombre=adjunto.nombre if adjunto else None,
        )
        # Avisos para los que mencionó con @usuario (se guardan junto con el mensaje).
        servidor = self.permisos.obtener_servidor(canal.servidor_id)
        NotificacionService(self.db).notificar_menciones(mensaje, canal, servidor, self.usuarios.find_by_id(actual_id))
        self.db.commit()
        return self._respuesta(mensaje, canal, actual_id)

    # ---------- HU8: listar mensajes con paginación ----------
    def listar(
        self, canal_id: int, actual_id: int, limite: int = LIMITE_POR_DEFECTO, antes_de: int | None = None
    ) -> list[MensajeResponseDTO]:
        canal = self._buscar_canal_o_404(canal_id)
        self.permisos.exigir_miembro(canal.servidor_id, actual_id)
        # Si estoy mirando el canal, sus menciones a mí ya no hace falta avisarlas.
        if antes_de is None and NotificacionService(self.db).leer_menciones_del_canal(actual_id, canal.id):
            self.db.commit()
        filas = self.mensajes.list_by_canal(canal.id, limite=limite, antes_de=antes_de)
        return self.armador.armar(filas, canal.servidor_id, actual_id)

    # ---------- HU8: editar (solo el autor) ----------
    def editar(self, mensaje_id: int, dto: UpdateMensajeDTO, actual_id: int) -> MensajeResponseDTO:
        mensaje = self._buscar_mensaje_o_404(mensaje_id)
        canal = self._buscar_canal_o_404(mensaje.canal_id)

        if mensaje.autor_id != actual_id:
            raise ForbiddenError("Solo el autor puede editar su mensaje")
        self.permisos.exigir_miembro(canal.servidor_id, actual_id)
        if self.encuestas.list_by_mensajes([mensaje.id]):
            raise UnprocessableError("Las encuestas no se pueden editar")

        contenido = self._validar_contenido(dto.contenido, permitir_vacio=mensaje.adjunto_url is not None)
        self.mensajes.update(mensaje, contenido=contenido, editado=True)
        self.db.commit()
        return self._respuesta(mensaje, canal, actual_id)

    # ---------- HU8: borrar (el autor o el dueño/moderador del servidor) ----------
    def borrar(self, mensaje_id: int, actual_id: int) -> None:
        mensaje = self._buscar_mensaje_o_404(mensaje_id)
        canal = self._buscar_canal_o_404(mensaje.canal_id)
        servidor = self.permisos.obtener_servidor(canal.servidor_id)

        es_autor = mensaje.autor_id == actual_id
        if not es_autor and not self.permisos.es_moderador(servidor, actual_id):
            raise ForbiddenError("Solo el autor o un moderador pueden borrar este mensaje")

        self.mensajes.delete(mensaje)
        self.db.commit()

    # ---------- Reacciones: poner o sacar un emoji ----------
    def reaccionar(self, mensaje_id: int, emoji: str, actual_id: int) -> MensajeResponseDTO:
        """Si ya había reaccionado con ese emoji, se lo saca (como en Discord)."""
        mensaje = self._buscar_mensaje_o_404(mensaje_id)
        canal = self._buscar_canal_o_404(mensaje.canal_id)
        self.permisos.exigir_miembro(canal.servidor_id, actual_id)
        emoji = self._validar_emoji(emoji)

        existente = self.reacciones.find(mensaje.id, actual_id, emoji)
        if existente is not None:
            self.reacciones.delete(existente)
        else:
            distintos = self.reacciones.emojis_distintos(mensaje.id)
            if emoji not in distintos and len(distintos) >= MAXIMO_EMOJIS_POR_MENSAJE:
                raise UnprocessableError(f"Un mensaje puede tener hasta {MAXIMO_EMOJIS_POR_MENSAJE} emojis distintos")
            try:
                self.reacciones.create(mensaje.id, actual_id, emoji)
            except IntegrityError:
                # Doble clic muy rápido: la reacción ya se guardó.
                self.db.rollback()
        self.db.commit()
        return self._respuesta(mensaje, canal, actual_id)

    # ---------- Fijar mensajes (dueño o moderador) ----------
    def fijar(self, mensaje_id: int, fijado: bool, actual_id: int) -> MensajeResponseDTO:
        mensaje = self._buscar_mensaje_o_404(mensaje_id)
        canal = self._buscar_canal_o_404(mensaje.canal_id)
        servidor = self.permisos.obtener_servidor(canal.servidor_id)
        self.permisos.exigir_moderador(servidor, actual_id)

        if fijado and not mensaje.fijado:
            if self.mensajes.contar_fijados(canal.id) >= MAXIMO_FIJADOS_POR_CANAL:
                raise UnprocessableError(f"Un canal puede tener hasta {MAXIMO_FIJADOS_POR_CANAL} mensajes fijados")
        self.mensajes.update(mensaje, fijado=fijado)
        self.db.commit()
        return self._respuesta(mensaje, canal, actual_id)

    def fijados(self, canal_id: int, actual_id: int) -> list[MensajeResponseDTO]:
        canal = self._buscar_canal_o_404(canal_id)
        self.permisos.exigir_miembro(canal.servidor_id, actual_id)
        return self.armador.armar(self.mensajes.list_fijados(canal.id), canal.servidor_id, actual_id)

    # ---------- Buscar mensajes en un servidor ----------
    def buscar(
        self, servidor_id: int, texto: str, actual_id: int, canal_id: int | None = None, autor_id: int | None = None
    ) -> list[MensajeResponseDTO]:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_miembro(servidor.id, actual_id)
        texto = texto.strip()
        if len(texto) < LARGO_MINIMO_BUSQUEDA:
            raise UnprocessableError(f"Escribí al menos {LARGO_MINIMO_BUSQUEDA} caracteres para buscar")
        if canal_id is not None:
            canal = self._buscar_canal_o_404(canal_id)
            if canal.servidor_id != servidor.id:
                raise NotFoundError("Ese canal no es de este servidor")
        filas = self.mensajes.buscar(servidor.id, texto, canal_id, autor_id, limite=25)
        return self.armador.armar(filas, servidor.id, actual_id)

    # ---------- Sección de multimedia de un servidor ----------
    def multimedia(
        self, servidor_id: int, tipo: str, actual_id: int, antes_de: int | None = None
    ) -> list[MensajeResponseDTO]:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_miembro(servidor.id, actual_id)
        if tipo not in TIPOS_MULTIMEDIA:
            raise UnprocessableError("Tipo inválido. Usá imagen, video, audio, archivo o link")
        filas = self.mensajes.multimedia(servidor.id, tipo, antes_de, limite=30)
        return self.armador.armar(filas, servidor.id, actual_id)

    # ---------- Encuestas (con fecha límite o sin) ----------
    def crear_encuesta(self, canal_id: int, dto: CreateEncuestaDTO, actual_id: int) -> MensajeResponseDTO:
        canal = self._buscar_canal_o_404(canal_id)
        self._validar_escritura(canal, actual_id)

        pregunta = self._validar_contenido(dto.pregunta)
        opciones = [o.strip() for o in dto.opciones]
        if any(not o for o in opciones):
            raise UnprocessableError("Las opciones no pueden estar vacías")
        if any(len(o) > 100 for o in opciones):
            raise UnprocessableError("Cada opción puede tener hasta 100 caracteres")
        if len({o.lower() for o in opciones}) != len(opciones):
            raise UnprocessableError("Hay opciones repetidas")
        if not 2 <= len(opciones) <= 10:
            raise UnprocessableError("Una encuesta tiene entre 2 y 10 opciones")

        fecha_limite = a_hora_local(dto.fecha_limite) if dto.fecha_limite else None
        if fecha_limite is not None and fecha_limite <= ahora():
            raise UnprocessableError("La fecha límite tiene que ser en el futuro")

        try:
            mensaje = self.mensajes.create(canal_id=canal.id, autor_id=actual_id, contenido=pregunta)
            encuesta = self.encuestas.create(mensaje.id, dto.multiple, fecha_limite)
            for orden, texto in enumerate(opciones):
                self.encuestas.agregar_opcion(encuesta.id, texto, orden)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return self._respuesta(mensaje, canal, actual_id)

    def votar(self, encuesta_id: int, dto: VotarDTO, actual_id: int) -> MensajeResponseDTO:
        encuesta = self.encuestas.find_by_id(encuesta_id)
        if encuesta is None:
            raise NotFoundError("Encuesta no encontrada")
        mensaje = self._buscar_mensaje_o_404(encuesta.mensaje_id)
        canal = self._buscar_canal_o_404(mensaje.canal_id)
        self.permisos.exigir_miembro(canal.servidor_id, actual_id)

        if encuesta.fecha_limite is not None and encuesta.fecha_limite <= ahora():
            raise UnprocessableError("La encuesta ya cerró")
        elegidas = list(dict.fromkeys(dto.opcion_ids))  # sin repetidos
        if len(elegidas) > 1 and not encuesta.multiple:
            raise UnprocessableError("En esta encuesta se puede elegir una sola opción")
        validas = {o.id for o in self.encuestas.opciones_de([encuesta.id])}
        if any(o not in validas for o in elegidas):
            raise UnprocessableError("Esa opción no es de esta encuesta")

        try:
            # Votar de nuevo reemplaza el voto anterior.
            self.encuestas.borrar_votos(encuesta.id, actual_id)
            for opcion_id in elegidas:
                self.encuestas.votar(encuesta.id, opcion_id, actual_id)
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise ConflictError("Tu voto ya se estaba guardando. Probá de nuevo.")
        return self._respuesta(mensaje, canal, actual_id)

    # ---------- Ayudas internas ----------
    def _respuesta(self, mensaje: Mensaje, canal: Canal, actual_id: int) -> MensajeResponseDTO:
        autor = self.usuarios.find_by_id(mensaje.autor_id)
        return self.armador.armar_uno(mensaje, autor, canal.servidor_id, actual_id)

    def _validar_escritura(self, canal: Canal, actual_id: int) -> None:
        """Reglas de HU7 para poder publicar en un canal."""
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

    @staticmethod
    def _validar_contenido(contenido: str, permitir_vacio: bool = False) -> str:
        contenido = contenido.strip()
        if not contenido and not permitir_vacio:
            raise UnprocessableError("El mensaje no puede estar vacío")
        if len(contenido) > LARGO_MAXIMO_MENSAJE:
            raise UnprocessableError("El mensaje no puede superar los 2000 caracteres")
        return contenido

    @staticmethod
    def _validar_emoji(emoji: str) -> str:
        emoji = emoji.strip()
        # Un emoji no tiene espacios y no es texto común (letras o números sueltos).
        if not emoji or any(c.isspace() for c in emoji) or emoji.isascii():
            raise UnprocessableError("Reacción inválida: tiene que ser un emoji")
        return emoji

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

