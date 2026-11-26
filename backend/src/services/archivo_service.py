from src.dtos.archivo_dto import AdjuntoDTO, ArchivoResponseDTO
from src.utils import archivos
from src.utils.errors import UnprocessableError


class ArchivoService:
    """Reglas para subir archivos y para validar adjuntos."""

    def subir(self, contenido: bytes, nombre: str, content_type: str | None) -> ArchivoResponseDTO:
        if not contenido:
            raise UnprocessableError("El archivo está vacío")
        if len(contenido) > archivos.TAMANIO_MAXIMO:
            raise UnprocessableError("El archivo no puede pesar más de 15 MB")
        tipo = archivos.tipo_de_archivo(nombre, content_type)
        if tipo is None:
            raise UnprocessableError(
                "Tipo de archivo no permitido. Se aceptan imágenes, audios, videos, PDF, TXT, ZIP y documentos de Office."
            )
        url = archivos.guardar(contenido, nombre)
        return ArchivoResponseDTO(url=url, tipo=tipo, nombre=nombre[:255], tamanio=len(contenido))

    @staticmethod
    def validar_adjunto(adjunto: AdjuntoDTO | None) -> AdjuntoDTO | None:
        """Un adjunto solo puede apuntar a un archivo subido a Kort."""
        if adjunto is None:
            return None
        if not archivos.es_url_propia(adjunto.url):
            raise UnprocessableError("El adjunto tiene que ser un archivo subido a Kort")
        # El tipo sale de la extensión del archivo guardado, no de lo que diga el cliente
        # (un .zip no puede hacerse pasar por imagen). Un .webm puede ser audio o video.
        real = archivos.tipo_de_archivo(adjunto.url, None)
        ambiguo = adjunto.url.lower().endswith(tuple(archivos.EXTENSIONES_AMBIGUAS))
        tipo = adjunto.tipo if ambiguo and adjunto.tipo in ("audio", "video") else real
        if tipo is None:
            raise UnprocessableError("Tipo de adjunto inválido")
        nombre = (adjunto.nombre or "").strip()[:255] or None
        return AdjuntoDTO(url=adjunto.url, tipo=tipo, nombre=nombre)

    @staticmethod
    def validar_imagen(url: str | None) -> str | None:
        """Para fotos de perfil, publicaciones y estados: solo imágenes subidas a Kort."""
        if url is None:
            return None
        if not archivos.es_url_propia(url) or archivos.tipo_de_archivo(url, None) != "imagen":
            raise UnprocessableError("La imagen tiene que ser un archivo de imagen subido a Kort")
        return url
