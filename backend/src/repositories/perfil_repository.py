from sqlalchemy.orm import Session

from src.db.models.perfil_model import EtiquetaUsuario, FotoPerfil, RedSocial


class PerfilRepository:
    """Consultas a etiquetas, redes sociales y fotos de perfil. Hace flush; el service confirma."""

    def __init__(self, db: Session):
        self.db = db

    # ---------- Etiquetas ----------
    def etiquetas(self, usuario_id: int) -> list[str]:
        filas = (
            self.db.query(EtiquetaUsuario.etiqueta)
            .filter(EtiquetaUsuario.usuario_id == usuario_id)
            .order_by(EtiquetaUsuario.etiqueta)
            .all()
        )
        return [e for (e,) in filas]

    def reemplazar_etiquetas(self, usuario_id: int, etiquetas: list[str]) -> None:
        self.db.query(EtiquetaUsuario).filter(EtiquetaUsuario.usuario_id == usuario_id).delete()
        for e in etiquetas:
            self.db.add(EtiquetaUsuario(usuario_id=usuario_id, etiqueta=e))
        self.db.flush()

    # ---------- Redes sociales ----------
    def redes(self, usuario_id: int) -> list[RedSocial]:
        return self.db.query(RedSocial).filter(RedSocial.usuario_id == usuario_id).order_by(RedSocial.red).all()

    def reemplazar_redes(self, usuario_id: int, redes: list[tuple[str, str]]) -> None:
        self.db.query(RedSocial).filter(RedSocial.usuario_id == usuario_id).delete()
        for red, url in redes:
            self.db.add(RedSocial(usuario_id=usuario_id, red=red, url=url))
        self.db.flush()

    # ---------- Fotos ----------
    def fotos(self, usuario_id: int) -> list[FotoPerfil]:
        return (
            self.db.query(FotoPerfil)
            .filter(FotoPerfil.usuario_id == usuario_id)
            .order_by(FotoPerfil.principal.desc(), FotoPerfil.id)
            .all()
        )

    def find_foto(self, foto_id: int) -> FotoPerfil | None:
        return self.db.query(FotoPerfil).filter(FotoPerfil.id == foto_id).first()

    def agregar_foto(self, usuario_id: int, url: str, principal: bool) -> FotoPerfil:
        foto = FotoPerfil(usuario_id=usuario_id, url=url, principal=principal)
        self.db.add(foto)
        self.db.flush()
        return foto

    def marcar_principal(self, usuario_id: int, foto_id: int | None) -> None:
        """Deja como principal solo a `foto_id` (o a ninguna si es None)."""
        for foto in self.fotos(usuario_id):
            foto.principal = foto.id == foto_id
        self.db.flush()

    def borrar_foto(self, foto: FotoPerfil) -> None:
        self.db.delete(foto)
        self.db.flush()
