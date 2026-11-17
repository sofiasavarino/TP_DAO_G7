from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.enums import EstadoReserva


class ReservaCreate(BaseModel):
    """Entrada: solicitud de reserva de un libro. La fecha de expiración la define el service."""

    socio_id: int
    libro_id: int


class ReservaDTO(BaseModel):
    """Salida de ficha/listado de reservas."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha_reserva: date
    fecha_asignacion: date | None = None
    fecha_expiracion: date | None = None
    estado: EstadoReserva
    socio_id: int
    libro_id: int
    ejemplar_id: int | None = None
