from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import EstadoPrestamo, TipoPrestamo

if TYPE_CHECKING:
    from app.models.ejemplar import Ejemplar
    from app.models.sancion import Sancion
    from app.models.socio import Socio


class Prestamo(Base):
    __tablename__ = "prestamo"

    id: Mapped[int] = mapped_column(primary_key=True)
    numero: Mapped[str] = mapped_column(String(20), unique=True)
    tipo: Mapped[TipoPrestamo] = mapped_column(Enum(TipoPrestamo, native_enum=False))
    estado: Mapped[EstadoPrestamo] = mapped_column(
        Enum(EstadoPrestamo, native_enum=False), default=EstadoPrestamo.ACTIVO
    )
    fecha_inicio: Mapped[date] = mapped_column(default=date.today)
    fecha_vencimiento: Mapped[date]
    fecha_devolucion: Mapped[date | None]
    observaciones: Mapped[str | None] = mapped_column(Text)

    socio_id: Mapped[int] = mapped_column(ForeignKey("socio.id"))
    ejemplar_id: Mapped[int] = mapped_column(ForeignKey("ejemplar.id"))

    socio: Mapped["Socio"] = relationship(back_populates="prestamos")
    ejemplar: Mapped["Ejemplar"] = relationship(back_populates="prestamos")
    sanciones: Mapped[list["Sancion"]] = relationship(back_populates="prestamo")
