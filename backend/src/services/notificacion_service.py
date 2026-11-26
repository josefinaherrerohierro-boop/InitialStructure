import re

from sqlalchemy.orm import Session

from src.db.models.canal_model import Canal
from src.db.models.mensaje_model import Mensaje
from src.db.models.servidor_model import Servidor
from src.db.models.usuario_model import Usuario
from src.dtos.notificacion_dto import NotificacionDTO, NotificacionesDTO
from src.mappers.social_mapper import to_usuario_resumen
from src.repositories.miembro_repository import MiembroRepository
from src.repositories.notificacion_repository import NotificacionRepository
from src.repositories.usuario_repository import UsuarioRepository

# @usuario: letras, números, "_" y "." (como los nombres de usuario), sin
# terminar en punto. No cuenta si va pegado a otra palabra (ej: ana@mail.com).
PATRON_MENCION = re.compile(r"(?<![\w.@])@([A-Za-z0-9_.]*[A-Za-z0-9_])")
MAXIMO_MENCIONES = 20
LARGO_EXTRACTO = 60


def _extracto(texto: str) -> str:
    texto = " ".join((texto or "").split())
    return texto if len(texto) <= LARGO_EXTRACTO else texto[: LARGO_EXTRACTO - 1] + "…"


def usernames_mencionados(texto: str) -> list[str]:
    """Los @usuario que aparecen en un texto (en minúscula, sin repetir)."""
    vistos: list[str] = []
    for nombre in PATRON_MENCION.findall(texto or ""):
        nombre = nombre.lower()
        if 3 <= len(nombre) <= 32 and nombre not in vistos:
            vistos.append(nombre)
    return vistos[:MAXIMO_MENCIONES]


class NotificacionService:
    """Avisos para cada usuario.

    Se generan solos desde otros services (cuando te mencionan, te escriben por
    privado, te mandan una solicitud de amistad o te asignan una tarea). Los
    métodos `notificar_*` solo hacen flush: el service que los llama confirma
    todo junto con su propio commit.
    """

    def __init__(self, db: Session):
        self.db = db
        self.notificaciones = NotificacionRepository(db)
        self.usuarios = UsuarioRepository(db)
        self.miembros = MiembroRepository(db)

    # ---------- Consultar y marcar como leídas ----------
    def listar(self, actual_id: int) -> NotificacionesDTO:
        items = self.notificaciones.list_de_usuario(actual_id)
        actores = {n.actor_id for n in items if n.actor_id}
        usuarios = {u.id: u for u in (self.usuarios.find_by_id(i) for i in actores) if u}
        return NotificacionesDTO(
            no_leidas=self.notificaciones.contar_no_leidas(actual_id),
            items=[
                NotificacionDTO(
                    id=n.id,
                    tipo=n.tipo,
                    texto=n.texto,
                    actor=to_usuario_resumen(usuarios[n.actor_id]) if n.actor_id in usuarios else None,
                    servidor_id=n.servidor_id,
                    canal_id=n.canal_id,
                    mensaje_id=n.mensaje_id,
                    leida=n.leida,
                    fecha=n.fecha,
                )
                for n in items
            ],
        )

    def leer(self, actual_id: int, ids: list[int] | None) -> NotificacionesDTO:
        self.notificaciones.marcar_leidas(actual_id, ids)
        self.db.commit()
        return self.listar(actual_id)

    # ---------- Generar avisos (los llaman otros services) ----------
    def notificar_menciones(self, mensaje: Mensaje, canal: Canal, servidor: Servidor, autor: Usuario) -> None:
        """A cada miembro del servidor mencionado con @usuario (menos el autor)."""
        for nombre in usernames_mencionados(mensaje.contenido):
            usuario = self.usuarios.find_by_username(nombre)
            if usuario is None or usuario.id == autor.id:
                continue
            miembro = self.miembros.find(usuario.id, servidor.id)
            if miembro is None or miembro.baneado:
                continue
            self.notificaciones.create(
                usuario_id=usuario.id,
                tipo="mencion",
                actor_id=autor.id,
                texto=f"{autor.username} te mencionó en #{canal.nombre} ({servidor.nombre}): {_extracto(mensaje.contenido)}"[:200],
                servidor_id=servidor.id,
                canal_id=canal.id,
                mensaje_id=mensaje.id,
            )

    def notificar_mensaje_directo(self, remitente: Usuario, destinatario_id: int, contenido: str) -> None:
        """Un solo aviso por conversación: si ya había uno sin leer, se actualiza."""
        texto = f"{remitente.username} te escribió: {_extracto(contenido) or 'te mandó un archivo'}"[:200]
        existente = self.notificaciones.dm_no_leida(destinatario_id, remitente.id)
        if existente is not None:
            self.notificaciones.renovar(existente, texto)
            return
        self.notificaciones.create(usuario_id=destinatario_id, tipo="mensaje_directo", actor_id=remitente.id, texto=texto)

    def notificar_solicitud(self, solicitante: Usuario, receptor_id: int) -> None:
        self.notificaciones.create(
            usuario_id=receptor_id,
            tipo="solicitud_amistad",
            actor_id=solicitante.id,
            texto=f"{solicitante.username} te mandó una solicitud de amistad",
        )

    def notificar_amistad_aceptada(self, quien_acepto: Usuario, otro_id: int) -> None:
        self.notificaciones.create(
            usuario_id=otro_id,
            tipo="amistad_aceptada",
            actor_id=quien_acepto.id,
            texto=f"Ahora sos amigo de {quien_acepto.username}",
        )

    def notificar_tarea(self, quien_asigna: Usuario, asignado_id: int, titulo: str, servidor: Servidor) -> None:
        self.notificaciones.create(
            usuario_id=asignado_id,
            tipo="tarea_asignada",
            actor_id=quien_asigna.id,
            texto=f'{quien_asigna.username} te asignó la tarea "{_extracto(titulo)}" en {servidor.nombre}'[:200],
            servidor_id=servidor.id,
        )

    # ---------- Al abrir un canal o una conversación ----------
    def leer_menciones_del_canal(self, actual_id: int, canal_id: int) -> int:
        return self.notificaciones.marcar_leidas_de(actual_id, "mencion", canal_id=canal_id)

    def leer_directos_de(self, actual_id: int, otro_id: int) -> int:
        return self.notificaciones.marcar_leidas_de(actual_id, "mensaje_directo", actor_id=otro_id)
