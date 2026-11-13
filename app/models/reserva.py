from datetime import date
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import EstadoReserva

if TYPE_CHECKING:
    from app.models.ejemplar import Ejemplar
    from app.models.libro import Libro
    from app.models.socio import Socio


class Reserva(Base):
    __tablename__ = "reserva"

    id: Mapped[int] = mapped_column(primary_key=True)
    fecha_reserva: Mapped[date] = mapped_column(default=date.today)
    fecha_asignacion: Mapped[date | None]
    fecha_expiracion: Mapped[date | None]
    estado: Mapped[EstadoReserva] = mapped_column(
        Enum(EstadoReserva, native_enum=False), default=EstadoReserva.PENDIENTE
    )

    socio_id: Mapped[int] = mapped_column(ForeignKey("socio.id"))
    libro_id: Mapped[int] = mapped_column(ForeignKey("libro.id"))
    # Se completa recien al asignar un ejemplar.
    ejemplar_id: Mapped[int | None] = mapped_column(ForeignKey("ejemplar.id"))

    socio: Mapped["Socio"] = relationship(back_populates="reservas")
    libro: Mapped["Libro"] = relationship(back_populates="reservas")
    ejemplar: Mapped[Optional["Ejemplar"]] = relationship()
