from datetime import datetime


def ahora() -> datetime:
    """Fecha y hora local actual, sin zona horaria.

    La base guarda las fechas como TIMESTAMP (sin zona), con la hora local
    del servidor. Para comparar, usamos siempre el mismo formato.
    """
    return datetime.now()


def a_hora_local(fecha: datetime) -> datetime:
    """Si la fecha viene con zona horaria (ej: "...Z"), la pasa a hora local
    sin zona, para poder compararla y guardarla igual que las demás."""
    if fecha.tzinfo is not None:
        return fecha.astimezone().replace(tzinfo=None)
    return fecha
