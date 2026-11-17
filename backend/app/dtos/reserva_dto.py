from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.enums import EstadoReserva


class ReservaCreate(BaseModel):
    """Entrada: solicitud de reserva de un libro con sede concreta de retiro."""

    socio_id: int
    libro_id: int
    sede_retiro_id: int


class ReservaDTO(BaseModel):
    """Salida de ficha/listado de reservas (ventana de retiro por 48 hs)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha_reserva: date
    fecha_asignacion: date | None = None
    fecha_vencimiento_retiro: date | None = None
    estado: EstadoReserva
    socio_id: int
    libro_id: int
    sede_retiro_id: int
    ejemplar_id: int | None = None
