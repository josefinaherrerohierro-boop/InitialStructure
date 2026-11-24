from datetime import timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.db.models.estado_model import DURACION_ESTADO_HORAS
from src.db.models.publicacion_model import Publicacion
from src.db.models.usuario_model import Usuario
from src.dtos.publicacion_dto import (
    ComentarioDTO,
    CreateEstadoDTO,
    CreatePublicacionDTO,
    EstadoDTO,
    EstadosDeUsuarioDTO,
    PublicacionDTO,
)
from src.mappers.social_mapper import to_usuario_resumen
from src.repositories.amistad_repository import AmistadRepository
from src.repositories.publicacion_repository import PublicacionRepository
from src.repositories.usuario_repository import UsuarioRepository
from src.services.archivo_service import ArchivoService
from src.services.permisos_service import PermisosService
from src.utils.errors import ForbiddenError, NotFoundError, UnprocessableError
from src.utils.fechas import ahora

POR_PAGINA = 20
MAXIMO_ESTADOS_ACTIVOS = 10


class PublicacionService:
    """Publicaciones (del perfil o de un servidor), likes, comentarios y estados.

    - Publicación de perfil: la ve cualquier usuario en el perfil; en el feed
      aparecen las tuyas y las de tus amigos.
    - Publicación de servidor: solo la ven los miembros de ese servidor.
    - Estados: duran 24 horas y los ven tus amigos.
    """

    def __init__(self, db: Session):
        self.db = db
        self.publicaciones = PublicacionRepository(db)
        self.usuarios = UsuarioRepository(db)
        self.amistades = AmistadRepository(db)
        self.permisos = PermisosService(db)

    # ---------- Listados ----------
    def feed(self, actual_id: int, antes_de: int | None = None) -> list[PublicacionDTO]:
        autores = [actual_id, *self.amistades.ids_de_amigos(actual_id)]
        return self._armar(self.publicaciones.de_perfiles(autores, antes_de, POR_PAGINA), actual_id)

    def de_perfil(self, usuario_id: int, actual_id: int, antes_de: int | None = None) -> list[PublicacionDTO]:
        if self.usuarios.find_by_id(usuario_id) is None:
            raise NotFoundError("Usuario no encontrado")
        return self._armar(self.publicaciones.de_perfiles([usuario_id], antes_de, POR_PAGINA), actual_id)

    def de_servidor(self, servidor_id: int, actual_id: int, antes_de: int | None = None) -> list[PublicacionDTO]:
        servidor = self.permisos.obtener_servidor(servidor_id)
        self.permisos.exigir_miembro(servidor.id, actual_id)
        return self._armar(self.publicaciones.de_servidor(servidor.id, antes_de, POR_PAGINA), actual_id)

    # ---------- Crear / borrar ----------
    def crear(self, dto: CreatePublicacionDTO, actual_id: int) -> PublicacionDTO:
        imagen = ArchivoService.validar_imagen(dto.imagen_url)
        contenido = dto.contenido.strip()
        if not contenido and not imagen:
            raise UnprocessableError("La publicación tiene que tener texto o una imagen")
        if dto.servidor_id is not None:
            servidor = self.permisos.obtener_servidor(dto.servidor_id)
            if not self.permisos.puede_escribir(servidor.id, actual_id):
                raise ForbiddenError("No tenés permiso para publicar en este servidor")
        p = self.publicaciones.create(actual_id, contenido, imagen, dto.servidor_id)
        self.db.commit()
        return self._armar([(p, self.usuarios.find_by_id(actual_id))], actual_id)[0]

    def borrar(self, publicacion_id: int, actual_id: int) -> None:
        p = self._buscar_visible(publicacion_id, actual_id)
        es_moderador = p.servidor_id is not None and self.permisos.es_moderador(
            self.permisos.obtener_servidor(p.servidor_id), actual_id
        )
        if p.autor_id != actual_id and not es_moderador:
            raise ForbiddenError("Solo el autor o un moderador pueden borrar esta publicación")
        self.publicaciones.delete(p)
        self.db.commit()

    # ---------- Me gusta (alternar) ----------
    def alternar_like(self, publicacion_id: int, actual_id: int) -> PublicacionDTO:
        p = self._buscar_visible(publicacion_id, actual_id)
        like = self.publicaciones.find_like(p.id, actual_id)
        try:
            if like:
                self.publicaciones.quitar_like(like)
            else:
                self.publicaciones.agregar_like(p.id, actual_id)
            self.db.commit()
        except IntegrityError:
            self.db.rollback()  # doble clic: ya estaba guardado
        return self._armar([(p, self.usuarios.find_by_id(p.autor_id))], actual_id)[0]

    # ---------- Comentarios ----------
    def comentarios(self, publicacion_id: int, actual_id: int) -> list[ComentarioDTO]:
        p = self._buscar_visible(publicacion_id, actual_id)
        return [self._comentario_dto(c, autor) for c, autor in self.publicaciones.comentarios(p.id)]

    def comentar(self, publicacion_id: int, contenido: str, actual_id: int) -> ComentarioDTO:
        p = self._buscar_visible(publicacion_id, actual_id)
        contenido = contenido.strip()
        if not contenido:
            raise UnprocessableError("El comentario no puede estar vacío")
        c = self.publicaciones.agregar_comentario(p.id, actual_id, contenido[:500])
        self.db.commit()
        return self._comentario_dto(c, self.usuarios.find_by_id(actual_id))

    def borrar_comentario(self, comentario_id: int, actual_id: int) -> None:
        c = self.publicaciones.find_comentario(comentario_id)
        if c is None:
            raise NotFoundError("Comentario no encontrado")
        p = self._buscar_visible(c.publicacion_id, actual_id)
        # Lo borra quien lo escribió o el autor de la publicación.
        if actual_id not in (c.autor_id, p.autor_id):
            raise ForbiddenError("No podés borrar este comentario")
        self.publicaciones.borrar_comentario(c)
        self.db.commit()

    # ---------- Estados ----------
    def estados(self, actual_id: int) -> list[EstadosDeUsuarioDTO]:
        """Estados activos míos y de mis amigos. Los míos primero."""
        ids = [actual_id, *self.amistades.ids_de_amigos(actual_id)]
        por_usuario: dict[int, list] = {}
        for e in self.publicaciones.estados_activos(ids, ahora()):
            por_usuario.setdefault(e.usuario_id, []).append(EstadoDTO.model_validate(e))
        resultado = [
            EstadosDeUsuarioDTO(usuario=to_usuario_resumen(self.usuarios.find_by_id(uid)), estados=estados)
            for uid, estados in por_usuario.items()
        ]
        # Primero los míos; después, el que subió algo más recientemente.
        return sorted(resultado, key=lambda g: (g.usuario.id != actual_id, -g.estados[-1].fecha.timestamp()))

    def crear_estado(self, dto: CreateEstadoDTO, actual_id: int) -> EstadoDTO:
        imagen = ArchivoService.validar_imagen(dto.imagen_url)
        contenido = dto.contenido.strip()
        if not contenido and not imagen:
            raise UnprocessableError("El estado tiene que tener texto o una imagen")
        momento = ahora()
        if self.publicaciones.contar_activos(actual_id, momento) >= MAXIMO_ESTADOS_ACTIVOS:
            raise UnprocessableError(f"Podés tener hasta {MAXIMO_ESTADOS_ACTIVOS} estados a la vez")
        e = self.publicaciones.crear_estado(
            actual_id, contenido[:200], imagen, dto.color_fondo.lower(), momento + timedelta(hours=DURACION_ESTADO_HORAS)
        )
        self.db.commit()
        return EstadoDTO.model_validate(e)

    def borrar_estado(self, estado_id: int, actual_id: int) -> None:
        e = self.publicaciones.find_estado(estado_id)
        if e is None or e.usuario_id != actual_id:
            raise NotFoundError("Estado no encontrado")
        self.publicaciones.borrar_estado(e)
        self.db.commit()

    # ---------- Ayudas internas ----------
    def _buscar_visible(self, publicacion_id: int, actual_id: int) -> Publicacion:
        p = self.publicaciones.find_by_id(publicacion_id)
        if p is None:
            raise NotFoundError("Publicación no encontrada")
        if p.servidor_id is not None and not self.permisos.es_miembro(p.servidor_id, actual_id):
            raise NotFoundError("Publicación no encontrada")
        return p

    def _armar(self, filas: list[tuple[Publicacion, Usuario]], actual_id: int) -> list[PublicacionDTO]:
        ids = [p.id for p, _ in filas]
        likes = self.publicaciones.likes_por_publicacion(ids)
        mios = self.publicaciones.con_mi_like(ids, actual_id)
        comentarios = self.publicaciones.comentarios_por_publicacion(ids)
        return [
            PublicacionDTO(
                id=p.id,
                autor=to_usuario_resumen(autor),
                servidor_id=p.servidor_id,
                contenido=p.contenido,
                imagen_url=p.imagen_url,
                fecha=p.fecha,
                likes=likes.get(p.id, 0),
                me_gusta=p.id in mios,
                comentarios=comentarios.get(p.id, 0),
            )
            for p, autor in filas
        ]

    @staticmethod
    def _comentario_dto(c, autor: Usuario) -> ComentarioDTO:
        return ComentarioDTO(
            id=c.id, publicacion_id=c.publicacion_id, autor=to_usuario_resumen(autor), contenido=c.contenido, fecha=c.fecha
        )
