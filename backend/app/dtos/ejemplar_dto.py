from pydantic import BaseModel, ConfigDict, Field, model_validator

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


class EjemplarEstadoUpdate(BaseModel):
    """Cuerpo para el endpoint PATCH de cambio de estado."""

    estado: EstadoEjemplar


class EjemplarLoteCreate(BaseModel):
    """Entrada: alta rápida de una o más copias de un libro en una sede inicial.

    La sede elegida es a la vez origen y sede actual. Si no se manda
    `codigo_inventario` (o se cargan varias copias) el backend genera los códigos.
    """

    libro_id: int
    sede_id: int
    cantidad: int = Field(1, ge=1, le=50)
    codigo_inventario: str | None = None
    signatura_topografica: str | None = None
    descripcion_fisica: str | None = None

    @model_validator(mode="after")
    def _codigo_solo_para_una_copia(self) -> "EjemplarLoteCreate":
        if self.codigo_inventario and self.codigo_inventario.strip() and self.cantidad != 1:
            raise ValueError("el código de inventario manual solo se puede usar con una copia")
        return self


class LibroResumenDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    isbn: str | None = None
    imagen_url: str | None = None


class SedeResumenDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str


class EjemplarInventarioDTO(EjemplarDTO):
    """Salida del inventario: el ejemplar con su libro y sedes ya resueltos."""

    libro: LibroResumenDTO
    sede_actual: SedeResumenDTO
    sede_origen: SedeResumenDTO
