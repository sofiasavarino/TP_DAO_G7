from pydantic import BaseModel, ConfigDict

from app.models.enums import EstadoEjemplar


class EjemplarCreate(BaseModel):
    """Entrada: alta física de un ejemplar."""

    codigo_inventario: str
    signatura_topografica: str | None = None
    descripcion_fisica: str | None = None
    libro_id: int
    sede_origen_id: int
    sede_actual_id: int


class EjemplarDTO(BaseModel):
    """Salida: ficha/lista de ejemplar."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo_inventario: str
    signatura_topografica: str | None = None
    descripcion_fisica: str | None = None
    estado: EstadoEjemplar
    libro_id: int
    sede_actual_id: int
    sede_origen_id: int
