from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.db.models.evento_model import Evento
from src.db.models.servidor_model import Servidor
from src.db.models.tarea_model import ESTADOS_TAREA, Tarea
from src.dtos.organizacion_dto import (
    DarPuntosDTO,
    EventoDatosDTO,
    EventoDTO,
    MovimientoPuntosDTO,
    PuntajeDTO,
    TareaDatosDTO,
    TareaDTO,
)
from src.mappers.social_mapper import to_usuario_resumen
from src.repositories.miembro_repository import MiembroRepository
from src.repositories.organizacion_repository import EventoRepository, PuntoRepository, TareaRepository
from src.repositories.usuario_repository import UsuarioRepository
from src.services.archivo_service import ArchivoService
from src.services.notificacion_service import NotificacionService
from src.services.permisos_service import PermisosService
from src.utils.errors import ForbiddenError, NotFoundError, UnprocessableError
from src.utils.fechas import a_hora_local, ahora


def _limpio(texto: str | None, campo: str, obligatorio: bool = False) -> str:
    texto = (texto or "").strip()
    if obligatorio and not texto:
        raise UnprocessableError(f"El {campo} no puede quedar vacío")
    return texto


class CalendarioService:
    """Eventos del calendario de un servidor.

    - Ver: cualquier miembro. Crear: miembros con permiso de escribir.
    - Editar o borrar: quien lo creó, o un moderador.
    """

    def __init__(self, db: Session):
        self.db = db
        self.eventos = EventoRepository(db)
        self.usuarios = UsuarioRepository(db)
        self.permisos = PermisosService(db)

    def listar(self, servidor_id: int, actual_id: int, desde: datetime | None, hasta: datetime | None) -> list[EventoDTO]:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_miembro(servidor.id, actual_id)
        desde = a_hora_local(desde) if desde else ahora() - timedelta(days=31)
        hasta = a_hora_local(hasta) if hasta else desde + timedelta(days=120)
        if hasta <= desde or hasta - desde > timedelta(days=400):
            raise UnprocessableError("Rango de fechas inválido (máximo 400 días)")
        return self._armar(self.eventos.list_entre(servidor.id, desde, hasta), actual_id)

    def crear(self, servidor_id: int, dto: EventoDatosDTO, actual_id: int) -> EventoDTO:
        servidor = self.permisos.obtener_servidor(servidor_id)
        if not self.permisos.puede_escribir(servidor.id, actual_id):
            raise ForbiddenError("No tenés permiso para crear eventos en este servidor")
        inicio, fin = self._validar_fechas(dto.inicio, dto.fin)
        evento = self.eventos.create(
            servidor_id=servidor.id,
            creador_id=actual_id,
            titulo=_limpio(dto.titulo, "título", obligatorio=True),
            descripcion=_limpio(dto.descripcion, "descripción"),
            lugar=_limpio(dto.lugar, "lugar"),
            inicio=inicio,
            fin=fin,
        )
        # Quien crea el evento queda anotado como que va.
        self.eventos.agregar_asistente(evento.id, actual_id)
        self.db.commit()
        return self._armar([evento], actual_id)[0]

    def editar(self, evento_id: int, dto: EventoDatosDTO, actual_id: int) -> EventoDTO:
        evento = self._buscar_editable(evento_id, actual_id)
        cambios = {}
        if dto.titulo is not None:
            cambios["titulo"] = _limpio(dto.titulo, "título", obligatorio=True)
        if dto.descripcion is not None:
            cambios["descripcion"] = _limpio(dto.descripcion, "descripción")
        if dto.lugar is not None:
            cambios["lugar"] = _limpio(dto.lugar, "lugar")
        if dto.inicio is not None or "fin" in dto.campos_enviados:
            # fin en null (mandado a propósito) = el evento no tiene hora de fin.
            fin = dto.fin if "fin" in dto.campos_enviados else evento.fin
            inicio, fin = self._validar_fechas(dto.inicio or evento.inicio, fin)
            cambios.update(inicio=inicio, fin=fin)
        self.eventos.update(evento, **cambios)
        self.db.commit()
        return self._armar([evento], actual_id)[0]

    def borrar(self, evento_id: int, actual_id: int) -> None:
        evento = self._buscar_editable(evento_id, actual_id)
        self.eventos.delete(evento)
        self.db.commit()

    def alternar_asistencia(self, evento_id: int, actual_id: int) -> EventoDTO:
        evento = self._buscar_visible(evento_id, actual_id)
        asistencia = self.eventos.find_asistencia(evento.id, actual_id)
        try:
            if asistencia:
                self.eventos.quitar_asistente(asistencia)
            else:
                self.eventos.agregar_asistente(evento.id, actual_id)
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
        return self._armar([evento], actual_id)[0]

    # ---------- Ayudas internas ----------
    @staticmethod
    def _validar_fechas(inicio: datetime | None, fin: datetime | None) -> tuple[datetime, datetime | None]:
        if inicio is None:
            raise UnprocessableError("El evento necesita una fecha de inicio")
        inicio = a_hora_local(inicio)
        fin = a_hora_local(fin) if fin else None
        if fin is not None and fin < inicio:
            raise UnprocessableError("El evento no puede terminar antes de empezar")
        return inicio, fin

    def _buscar_visible(self, evento_id: int, actual_id: int) -> Evento:
        evento = self.eventos.find_by_id(evento_id)
        if evento is None or not self.permisos.es_miembro(evento.servidor_id, actual_id):
            raise NotFoundError("Evento no encontrado")
        return evento

    def _buscar_editable(self, evento_id: int, actual_id: int) -> Evento:
        evento = self._buscar_visible(evento_id, actual_id)
        servidor = self.permisos.obtener_servidor(evento.servidor_id)
        if evento.creador_id != actual_id and not self.permisos.es_moderador(servidor, actual_id):
            raise ForbiddenError("Solo quien creó el evento o un moderador pueden cambiarlo")
        return evento

    def _armar(self, eventos: list[Evento], actual_id: int) -> list[EventoDTO]:
        asistentes: dict[int, list[int]] = defaultdict(list)
        for a in self.eventos.asistentes([e.id for e in eventos]):
            asistentes[a.evento_id].append(a.usuario_id)
        cache = {}

        def resumen(uid: int):
            if uid not in cache:
                cache[uid] = to_usuario_resumen(self.usuarios.find_by_id(uid))
            return cache[uid]

        return [
            EventoDTO(
                id=e.id,
                servidor_id=e.servidor_id,
                creador=resumen(e.creador_id),
                titulo=e.titulo,
                descripcion=e.descripcion,
                lugar=e.lugar,
                inicio=e.inicio,
                fin=e.fin,
                asistentes=[resumen(u) for u in asistentes[e.id]],
                voy=actual_id in asistentes[e.id],
            )
            for e in eventos
        ]


class TareaService:
    """Tareas de un servidor.

    - Crear: miembros con permiso de escribir. Asignarle una tarea a OTRA
      persona solo lo puede hacer un moderador (cualquiera se puede asignar a sí mismo).
    - Cambiar el estado (arrastrarla de columna): la persona asignada, quien
      la creó o un moderador.
    - Editar el resto (título, descripción, imagen, fecha) o borrar: quien la
      creó o un moderador/dueño.
    - Puntos: solo un moderador o el dueño fija cuántos puntos gana quien la
      complete. Se otorgan al pasarla a "hecha" (a la persona asignada o, si no
      hay, a quien la completó) y se descuentan si se vuelve a abrir.
    """

    def __init__(self, db: Session):
        self.db = db
        self.tareas = TareaRepository(db)
        self.puntos = PuntoRepository(db)
        self.usuarios = UsuarioRepository(db)
        self.permisos = PermisosService(db)

    def listar(self, servidor_id: int, actual_id: int, solo_mias: bool = False) -> list[TareaDTO]:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_miembro(servidor.id, actual_id)
        tareas = self.tareas.list_by_servidor(servidor.id, asignado_id=actual_id if solo_mias else None)
        return [self._dto(t) for t in tareas]

    def crear(self, servidor_id: int, dto: TareaDatosDTO, actual_id: int) -> TareaDTO:
        servidor = self.permisos.obtener_servidor(servidor_id)
        if not self.permisos.puede_escribir(servidor.id, actual_id):
            raise ForbiddenError("No tenés permiso para crear tareas en este servidor")
        if dto.asignado_id is not None:
            self._validar_asignacion(servidor, dto.asignado_id, actual_id)
        puntos = dto.puntos or 0
        if puntos and not self.permisos.es_moderador(servidor, actual_id):
            raise ForbiddenError("Solo un moderador o el dueño pueden ponerle puntos a una tarea")
        tarea = self.tareas.create(
            servidor_id=servidor.id,
            creador_id=actual_id,
            asignado_id=dto.asignado_id,
            titulo=_limpio(dto.titulo, "título", obligatorio=True),
            descripcion=_limpio(dto.descripcion, "descripción"),
            fecha_limite=a_hora_local(dto.fecha_limite) if dto.fecha_limite else None,
            estado="pendiente",
            imagen_url=ArchivoService.validar_imagen(dto.imagen_url),
            puntos=puntos,
        )
        self._avisar_asignacion(tarea, servidor, actual_id)
        self.db.commit()
        return self._dto(tarea)

    def editar(self, tarea_id: int, dto: TareaDatosDTO, actual_id: int) -> TareaDTO:
        tarea = self._buscar_visible(tarea_id, actual_id)
        servidor = self.permisos.obtener_servidor(tarea.servidor_id)
        es_moderador = self.permisos.es_moderador(servidor, actual_id)
        es_creador = tarea.creador_id == actual_id
        es_asignado = tarea.asignado_id == actual_id
        cambios = {}

        if "estado" in dto.campos_enviados and dto.estado is not None:
            if not (es_moderador or es_creador or es_asignado):
                raise ForbiddenError("Solo la persona asignada, quien la creó o un moderador pueden cambiar el estado")
            if dto.estado not in ESTADOS_TAREA:
                raise UnprocessableError("Estado inválido")
            if dto.estado != tarea.estado:
                cambios["estado"] = dto.estado
                cambios["fecha_completada"] = ahora() if dto.estado == "hecha" else None
                if dto.estado == "hecha":
                    cambios.update(self._otorgar_puntos(tarea, actual_id))
                elif tarea.estado == "hecha":
                    cambios.update(self._descontar_puntos(tarea))

        if "puntos" in dto.campos_enviados and dto.puntos is not None and dto.puntos != tarea.puntos:
            if not es_moderador:
                raise ForbiddenError("Solo un moderador o el dueño pueden cambiar los puntos de una tarea")
            if tarea.estado == "hecha" or cambios.get("estado") == "hecha":
                raise UnprocessableError("La tarea ya está hecha: volvé a abrirla para cambiar los puntos")
            cambios["puntos"] = dto.puntos

        otros = dto.campos_enviados & {"titulo", "descripcion", "fecha_limite", "asignado_id", "imagen_url"}
        if otros:
            # Tomar una tarea sin asignar (asignármela a mí) lo puede hacer cualquiera.
            solo_tomarla = otros == {"asignado_id"} and dto.asignado_id == actual_id and tarea.asignado_id is None
            if not (es_moderador or es_creador or solo_tomarla):
                raise ForbiddenError("Solo quien creó la tarea o un moderador pueden editarla")
            if "titulo" in otros and dto.titulo is not None:
                cambios["titulo"] = _limpio(dto.titulo, "título", obligatorio=True)
            if "descripcion" in otros and dto.descripcion is not None:
                cambios["descripcion"] = _limpio(dto.descripcion, "descripción")
            if "fecha_limite" in otros:
                cambios["fecha_limite"] = a_hora_local(dto.fecha_limite) if dto.fecha_limite else None
            if "asignado_id" in otros and dto.asignado_id != tarea.asignado_id:
                # Solo se valida si cambia: al editar el título se manda el mismo responsable.
                if dto.asignado_id is not None:
                    self._validar_asignacion(servidor, dto.asignado_id, actual_id)
                cambios["asignado_id"] = dto.asignado_id
            if "imagen_url" in otros and dto.imagen_url != tarea.imagen_url:
                cambios["imagen_url"] = ArchivoService.validar_imagen(dto.imagen_url)

        self.tareas.update(tarea, **cambios)
        if cambios.get("asignado_id"):
            self._avisar_asignacion(tarea, servidor, actual_id)
        self.db.commit()
        return self._dto(tarea)

    def borrar(self, tarea_id: int, actual_id: int) -> None:
        tarea = self._buscar_visible(tarea_id, actual_id)
        servidor = self.permisos.obtener_servidor(tarea.servidor_id)
        if tarea.creador_id != actual_id and not self.permisos.es_moderador(servidor, actual_id):
            raise ForbiddenError("Solo quien creó la tarea o un moderador pueden borrarla")
        self.tareas.delete(tarea)
        self.db.commit()

    # ---------- Ayudas internas ----------
    def _avisar_asignacion(self, tarea: Tarea, servidor: Servidor, actual_id: int) -> None:
        """Si alguien le asigna la tarea a OTRA persona, a esa persona le llega un aviso."""
        if tarea.asignado_id and tarea.asignado_id != actual_id:
            NotificacionService(self.db).notificar_tarea(
                self.usuarios.find_by_id(actual_id), tarea.asignado_id, tarea.titulo, servidor
            )

    def _otorgar_puntos(self, tarea: Tarea, actual_id: int) -> dict:
        """Al completar la tarea: le da sus puntos a la persona asignada (o, si
        no hay nadie asignado, a quien la completó). Solo si sigue siendo miembro."""
        if not tarea.puntos:
            return {}
        receptor = tarea.asignado_id or actual_id
        if not self.permisos.es_miembro(tarea.servidor_id, receptor):
            return {}
        self.puntos.create(tarea.servidor_id, receptor, tarea.puntos, f"Tarea: {tarea.titulo}"[:100], tarea.creador_id)
        return {"puntos_otorgados_a": receptor}

    def _descontar_puntos(self, tarea: Tarea) -> dict:
        """Si una tarea hecha se vuelve a abrir, se descuentan los puntos que se habían dado."""
        if not tarea.puntos or tarea.puntos_otorgados_a is None:
            return {}
        self.puntos.create(
            tarea.servidor_id, tarea.puntos_otorgados_a, -tarea.puntos, f"Tarea reabierta: {tarea.titulo}"[:100], None
        )
        return {"puntos_otorgados_a": None}

    def _validar_asignacion(self, servidor: Servidor, asignado_id: int, actual_id: int) -> None:
        if asignado_id != actual_id and not self.permisos.es_moderador(servidor, actual_id):
            raise ForbiddenError("Solo un moderador puede asignarle tareas a otras personas")
        if not self.permisos.es_miembro(servidor.id, asignado_id):
            raise UnprocessableError("Solo se pueden asignar tareas a miembros del servidor")

    def _buscar_visible(self, tarea_id: int, actual_id: int) -> Tarea:
        tarea = self.tareas.find_by_id(tarea_id)
        if tarea is None or not self.permisos.es_miembro(tarea.servidor_id, actual_id):
            raise NotFoundError("Tarea no encontrada")
        return tarea

    def _dto(self, t: Tarea) -> TareaDTO:
        asignado = self.usuarios.find_by_id(t.asignado_id) if t.asignado_id else None
        receptor = self.usuarios.find_by_id(t.puntos_otorgados_a) if t.puntos_otorgados_a else None
        return TareaDTO(
            id=t.id,
            servidor_id=t.servidor_id,
            creador=to_usuario_resumen(self.usuarios.find_by_id(t.creador_id)),
            asignado=to_usuario_resumen(asignado) if asignado else None,
            titulo=t.titulo,
            descripcion=t.descripcion,
            fecha_limite=t.fecha_limite,
            estado=t.estado,
            vencida=t.estado != "hecha" and t.fecha_limite is not None and t.fecha_limite < ahora(),
            fecha_creacion=t.fecha_creacion,
            fecha_completada=t.fecha_completada,
            imagen_url=t.imagen_url,
            puntos=t.puntos or 0,
            puntos_otorgados_a=to_usuario_resumen(receptor) if receptor else None,
        )


class ScoreboardService:
    """Tabla de puntos de un servidor.

    Los puntos los dan los moderadores (por ejemplo, por ganar un torneo) y
    también se ganan jugando en las llamadas. Como desempate se muestra la
    actividad: mensajes de los últimos 30 días y tareas terminadas.
    """

    def __init__(self, db: Session):
        self.db = db
        self.puntos = PuntoRepository(db)
        self.tareas = TareaRepository(db)
        self.miembros = MiembroRepository(db)
        self.usuarios = UsuarioRepository(db)
        self.permisos = PermisosService(db)

    def tabla(self, servidor_id: int, actual_id: int) -> list[PuntajeDTO]:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_miembro(servidor.id, actual_id)
        totales = self.puntos.totales(servidor.id)
        mensajes = self.puntos.mensajes_desde(servidor.id, ahora() - timedelta(days=30))
        tareas = self.tareas.hechas_por_usuario(servidor.id)
        avatares = self.miembros.avatares(servidor.id)

        filas = [
            (miembro, usuario, totales.get(usuario.id, 0), mensajes.get(usuario.id, 0), tareas.get(usuario.id, 0))
            for miembro, usuario in self.miembros.list_activos(servidor.id)
        ]
        filas.sort(key=lambda f: (-f[2], -f[4], -f[3], f[1].username))
        return [
            PuntajeDTO(
                posicion=i + 1,
                usuario=to_usuario_resumen(usuario).model_copy(
                    update={"avatar_url": avatares.get(usuario.id, usuario.avatar_url)}
                ),
                apodo=miembro.apodo,
                puntos=puntos,
                mensajes_30_dias=msgs,
                tareas_hechas=hechas,
            )
            for i, (miembro, usuario, puntos, msgs, hechas) in enumerate(filas)
        ]

    def movimientos(self, servidor_id: int, actual_id: int) -> list[MovimientoPuntosDTO]:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_miembro(servidor.id, actual_id)
        resultado = []
        for p in self.puntos.recientes(servidor.id):
            otorgante = self.usuarios.find_by_id(p.otorgado_por) if p.otorgado_por else None
            resultado.append(
                MovimientoPuntosDTO(
                    id=p.id,
                    usuario=to_usuario_resumen(self.usuarios.find_by_id(p.usuario_id)),
                    otorgado_por=to_usuario_resumen(otorgante) if otorgante else None,
                    cantidad=p.cantidad,
                    motivo=p.motivo,
                    fecha=p.fecha,
                )
            )
        return resultado

    def dar(self, servidor_id: int, dto: DarPuntosDTO, actual_id: int) -> list[PuntajeDTO]:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_moderador(servidor, actual_id)
        if dto.usuario_id == actual_id and not self.permisos.es_duenio(servidor, actual_id):
            raise ForbiddenError("No te podés dar puntos a vos mismo")
        if not self.permisos.es_miembro(servidor.id, dto.usuario_id):
            raise UnprocessableError("Solo se les dan puntos a miembros del servidor")
        if dto.cantidad == 0 or abs(dto.cantidad) > 1000:
            raise UnprocessableError("La cantidad tiene que estar entre -1000 y 1000 (y no ser 0)")
        self.puntos.create(servidor.id, dto.usuario_id, dto.cantidad, dto.motivo.strip()[:100], actual_id)
        self.db.commit()
        return self.tabla(servidor.id, actual_id)

    def sumar_automatico(self, servidor_id: int, usuario_id: int, cantidad: int, motivo: str) -> None:
        """Para los juegos de las llamadas: suma puntos sin que nadie los otorgue."""
        if self.permisos.es_miembro(servidor_id, usuario_id):
            self.puntos.create(servidor_id, usuario_id, cantidad, motivo[:100], None)
            self.db.commit()
