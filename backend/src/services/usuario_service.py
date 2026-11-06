from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.db.models.usuario_model import Usuario
from src.dtos.usuario_dto import CreateUsuarioDTO, UpdateUsuarioDTO, UsuarioResponseDTO
from src.mappers.usuario_mapper import to_usuario_response
from src.repositories.usuario_repository import UsuarioRepository
from src.utils.errors import ConflictError, NotFoundError
from src.utils.hash import hash_password


class UsuarioService:
    """Reglas de negocio de los usuarios (HU1)."""

    def __init__(self, db: Session):
        self.db = db
        self.repo = UsuarioRepository(db)

    # ---------- Registro (HU1) ----------
    def create(self, dto: CreateUsuarioDTO) -> UsuarioResponseDTO:
        # Se guardan en minúsculas para que "Ana@Mail.com" y "ana@mail.com"
        # cuenten como el mismo email (lo mismo con el username).
        email = dto.email.strip().lower()
        username = dto.username.strip().lower()

        self._verificar_email_libre(email)
        self._verificar_username_libre(username)

        try:
            usuario = self.repo.create(
                email=email,
                username=username,
                password_hash=hash_password(dto.password),
            )
        except IntegrityError:
            # Por si dos personas se registran con el mismo dato al mismo tiempo:
            # la restricción UNIQUE de la base es la última barrera.
            self.db.rollback()
            raise ConflictError("El email o el nombre de usuario ya están registrados")

        return to_usuario_response(usuario)

    # ---------- Consultas ----------
    def get_by_id(self, usuario_id: int) -> UsuarioResponseDTO:
        return to_usuario_response(self._buscar_o_404(usuario_id))

    def list_all(self) -> list[UsuarioResponseDTO]:
        return [to_usuario_response(u) for u in self.repo.list_all()]

    # ---------- Modificar la propia cuenta ----------
    def update(self, usuario_id: int, dto: UpdateUsuarioDTO) -> UsuarioResponseDTO:
        usuario = self._buscar_o_404(usuario_id)
        cambios = {}

        if dto.email is not None:
            email = dto.email.strip().lower()
            if email != usuario.email:
                self._verificar_email_libre(email)
                cambios["email"] = email

        if dto.username is not None:
            username = dto.username.strip().lower()
            if username != usuario.username:
                self._verificar_username_libre(username)
                cambios["username"] = username

        if dto.password is not None:
            cambios["password_hash"] = hash_password(dto.password)

        if cambios:
            try:
                usuario = self.repo.update(usuario, **cambios)
            except IntegrityError:
                self.db.rollback()
                raise ConflictError("El email o el nombre de usuario ya están registrados")

        return to_usuario_response(usuario)

    # ---------- Borrar la propia cuenta ----------
    def delete(self, usuario_id: int) -> None:
        usuario = self._buscar_o_404(usuario_id)
        try:
            self.repo.delete(usuario)
        except IntegrityError:
            # La FK servidores.duenio_id impide borrar a quien todavía es dueño.
            self.db.rollback()
            raise ConflictError(
                "No podés borrar tu cuenta mientras seas dueño de un servidor. "
                "Primero transferí la propiedad."
            )

    # ---------- Ayudas internas ----------
    def _buscar_o_404(self, usuario_id: int) -> Usuario:
        usuario = self.repo.find_by_id(usuario_id)
        if usuario is None:
            raise NotFoundError("Usuario no encontrado")
        return usuario

    def _verificar_email_libre(self, email: str) -> None:
        if self.repo.find_by_email(email) is not None:
            raise ConflictError("Ese email ya está registrado")

    def _verificar_username_libre(self, username: str) -> None:
        if self.repo.find_by_username(username) is not None:
            raise ConflictError("Ese nombre de usuario ya está en uso")
