class AppError(Exception):
    status_code: int = 500
    message: str = "Internal error"

    def __init__(self, message: str | None = None):
        if message:
            self.message = message
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code = 404
    message = "Resource not found"


class UnauthorizedError(AppError):
    status_code = 401
    message = "Unauthorized"


class ForbiddenError(AppError):
    status_code = 403
    message = "Forbidden"


class ConflictError(AppError):
    status_code = 409
    message = "Conflict"


class UnprocessableError(AppError):
    """Datos con formato válido pero que no cumplen una regla de negocio."""

    status_code = 422
    message = "Datos inválidos"
