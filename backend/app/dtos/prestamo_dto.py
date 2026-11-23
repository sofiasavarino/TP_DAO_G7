from datetime import date
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict

from app.models.enums import EstadoPrestamo, TipoPrestamo

if TYPE_CHECKING:
    # Solo hints para type-checker; no circular dependency en runtime.
    from app.models.prestamo import Prestamo


class PrestamoCreate(BaseModel):
    """Entrada: lo que manda la vista/controller para dar de alta un préstamo.

    La fecha de vencimiento NO la decide el cliente — se calcula en el service
    como `today() + DIAS_PRESTAMO`."""

    socio_id: int
    ejemplar_id: int
    tipo: TipoPrestamo
    observaciones: str | None = None


class PrestamoDTO(BaseModel):
    """Salida plana 1:1 con el modelo."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    numero: str
    tipo: TipoPrestamo
    estado: EstadoPrestamo
    socio_id: int
    ejemplar_id: int
    fecha_inicio: date
    fecha_vencimiento: date
    fecha_devolucion: date | None
    observaciones: str | None
    # Sin from_model: `PrestamoDTO.model_validate(prestamo)` alcanza.


class PrestamoListadoDTO(BaseModel):
    """Salida enriquecida para la grilla/pantallas: trae datos cruzados planos."""

    id: int
    numero: str
    estado: EstadoPrestamo
    tipo: TipoPrestamo
    fecha_inicio: date
    fecha_vencimiento: date
    fecha_devolucion: date | None = None
    socio_id: int
    socio_nombre: str
    ejemplar_id: int
    ejemplar_codigo: str
    # Libro del ejemplar (para "Mis préstamos" del portal de socios)
    libro_id: int
    libro_nombre: str
    libro_isbn: str | None = None
    libro_imagen_url: str | None = None
