from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from src.utils.errors import AppError


async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.__class__.__name__, "message": exc.message},
    )


# ---------------------------------------------------------------------------
# Errores de validación (422) en español.
# FastAPI/Pydantic los arman en inglés ("value is not a valid email address",
# "String should have at least 8 characters"...). Acá los traducimos para que
# el usuario vea, por ejemplo, "La contraseña tiene que tener al menos 8 caracteres".
# ---------------------------------------------------------------------------

# Cómo se llama cada campo en los mensajes (los que no estén, se muestran tal cual).
NOMBRES_DE_CAMPOS = {
    "email": "El email",
    "password": "La contraseña",
    "password_actual": "La contraseña actual",
    "password_nueva": "La contraseña nueva",
    "clave": "La contraseña",
    "clave_borrado": "La contraseña para borrar el servidor",
    "clave_nueva": "La contraseña nueva",
    "username": "El nombre de usuario",
    "nombre": "El nombre",
    "contenido": "El mensaje",
    "descripcion": "La descripción",
    "titulo": "El título",
    "bio": "La biografía",
    "codigo": "El código",
    "texto": "El texto",
}

PATRONES = {
    "username": "El nombre de usuario solo puede tener letras, números, puntos (.) y guiones bajos (_), sin espacios",
}


def _campo(loc) -> str:
    """Nombre del campo a partir de la ubicación del error, ej: ('body', 'password')."""
    partes = [str(p) for p in loc if p not in ("body", "query", "path", "header") and not isinstance(p, int)]
    return partes[-1] if partes else ""


def _error_de_email(msg: str) -> str:
    texto = msg.lower()
    if "@-sign" in texto and ("after" in texto or "domain" in texto):
        return "Revisá la parte del email que va después de la @ (por ejemplo, gmail.com)"
    if "@-sign" in texto and ("before" in texto or "local part" in texto):
        return "Revisá la parte del email que va antes de la @"
    if "@-sign" in texto:
        return "Al email le falta la @ (o tiene más de una)"
    if "period" in texto or "dot" in texto:
        return "El email tiene un punto (.) en un lugar que no va"
    if "domain" in texto:
        return "Revisá la parte del email que va después de la @ (por ejemplo, gmail.com)"
    return "El email no es válido. Revisá que esté bien escrito (ej: nombre@gmail.com)"


def traducir_error(error: dict) -> str:
    tipo = error.get("type", "")
    campo = _campo(error.get("loc", ()))
    nombre = NOMBRES_DE_CAMPOS.get(campo, campo.replace("_", " ").capitalize() or "El dato")
    ctx = error.get("ctx") or {}
    msg = str(error.get("msg", ""))

    if error.get("input") == "" and campo:
        return f"Falta completar: {nombre.lower()}"
    if campo == "email" and tipo in ("value_error", "string_type") or "email address" in msg:
        return _error_de_email(msg)
    if tipo == "missing":
        return f"Falta completar: {nombre.lower()}" if campo else "Faltan datos"
    if tipo == "string_too_short":
        minimo = ctx.get("min_length", 1)
        if minimo == 1:
            return f"{nombre} no puede estar vacío" if not nombre.startswith("La ") else f"{nombre} no puede estar vacía"
        return f"{nombre} tiene que tener al menos {minimo} caracteres"
    if tipo == "string_too_long":
        return f"{nombre} puede tener como máximo {ctx.get('max_length')} caracteres"
    if tipo == "string_pattern_mismatch":
        return PATRONES.get(campo, f"{nombre} tiene caracteres que no se permiten")
    if tipo in ("string_type", "string_sub_type"):
        return f"{nombre} tiene que ser un texto"
    if tipo in ("int_parsing", "int_type", "float_parsing", "float_type", "int_from_float"):
        return f"{nombre} tiene que ser un número"
    if tipo in ("bool_parsing", "bool_type"):
        return f"{nombre} tiene que ser sí o no"
    if tipo in ("greater_than_equal", "greater_than"):
        return f"{nombre} tiene que ser como mínimo {ctx.get('ge', ctx.get('gt'))}"
    if tipo in ("less_than_equal", "less_than"):
        return f"{nombre} tiene que ser como máximo {ctx.get('le', ctx.get('lt'))}"
    if tipo in ("too_short", "too_long"):
        return f"{nombre} tiene una cantidad de elementos que no se permite"
    if tipo in ("datetime_parsing", "datetime_type", "datetime_from_date_parsing", "date_parsing", "date_type"):
        return f"{nombre} no es una fecha válida"
    if tipo in ("literal_error", "enum"):
        return f"{nombre} tiene un valor que no se permite"
    if tipo in ("json_invalid", "model_type", "dict_type", "list_type"):
        return "Los datos enviados no tienen el formato correcto"
    if tipo == "value_error":
        # Errores que escribimos nosotros con ValueError en los schemas ("Value error, ...").
        return msg.removeprefix("Value error, ")
    return f"{nombre}: el dato no es válido" if campo else "Los datos enviados no son válidos"


async def validation_error_handler(request: Request, exc: RequestValidationError):
    errores = exc.errors()
    mensajes = []
    for e in errores:
        m = traducir_error(e)
        if m not in mensajes:
            mensajes.append(m)
    return JSONResponse(
        status_code=422,
        content={
            "error": "ValidationError",
            "message": ". ".join(mensajes) if mensajes else "Los datos enviados no son válidos",
            # Mismo formato que FastAPI, pero con los mensajes en español.
            "detail": [{"loc": list(e.get("loc", ())), "msg": traducir_error(e), "type": e.get("type")} for e in errores],
        },
    )
