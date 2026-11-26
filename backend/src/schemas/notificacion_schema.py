from pydantic import BaseModel, Field


class LeerNotificacionesSchema(BaseModel):
    """ids = cuáles marcar como leídas. Si no se manda (null), se marcan todas."""

    ids: list[int] | None = Field(default=None, max_length=200)
