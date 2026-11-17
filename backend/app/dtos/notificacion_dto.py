from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import NotificacionTipo


class NotificacionCreate(BaseModel):
    """Entrada interna: la genera el sistema; la vista no la crea."""

    usuario_id: int
    tipo: NotificacionTipo
    titulo: str
    cuerpo: str


class NotificacionDTO(BaseModel):
    """Salida: bandeja de notificaciones de la app."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo: NotificacionTipo
    titulo: str
    cuerpo: str
    leida: bool
    fecha_creacion: datetime
