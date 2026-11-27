import re

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    PORT: int = 8000
    JWT_SECRET: str
    # Dirección del frontend, para habilitar CORS (ver app.py)
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()


# Además de FRONTEND_URL, se aceptan pedidos del frontend abierto en la propia
# compu (localhost, cualquier puerto) y de los túneles de VS Code
# (*.devtunnels.ms), que sirven para probar la app desde otros dispositivos.
# Si algún día se publica la app, conviene dejar solo FRONTEND_URL.
ORIGENES_DE_PRUEBA = r"(http://(localhost|127\.0\.0\.1)(:\d+)?|https://[a-z0-9-]+(\.[a-z0-9-]+)*\.devtunnels\.ms)"


def origen_permitido(origen: str | None) -> bool:
    """¿El pedido viene de nuestro frontend? (se usa para los WebSockets de las llamadas)."""
    if not origen:
        return True
    origen = origen.rstrip("/")
    return origen == settings.FRONTEND_URL.rstrip("/") or re.fullmatch(ORIGENES_DE_PRUEBA, origen) is not None
