from datetime import date
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import EstadoPrestamo, TipoPrestamo

if TYPE_CHECKING:
    from app.models.ejemplar import Ejemplar
    from app.models.remito import Remito
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
    fecha_retiro: Mapped[date | None]
    fecha_devolucion: Mapped[date | None]
    observaciones: Mapped[str | None] = mapped_column(Text)

    socio_id: Mapped[int] = mapped_column(ForeignKey("socio.id"))
    ejemplar_id: Mapped[int] = mapped_column(ForeignKey("ejemplar.id"))
    # Solo los interbibliotecarios tienen remitos (ida y vuelta), ambos opcionales.
    remito_ida_id: Mapped[int | None] = mapped_column(ForeignKey("remito.id"))
    remito_devolucion_id: Mapped[int | None] = mapped_column(ForeignKey("remito.id"))

    socio: Mapped["Socio"] = relationship(back_populates="prestamos")
    ejemplar: Mapped["Ejemplar"] = relationship(back_populates="prestamos")
    remito_ida: Mapped[Optional["Remito"]] = relationship(
        foreign_keys=[remito_ida_id], back_populates="prestamos_ida"
    )
    remito_devolucion: Mapped[Optional["Remito"]] = relationship(
        foreign_keys=[remito_devolucion_id], back_populates="prestamos_devolucion"
    )
    sanciones: Mapped[list["Sancion"]] = relationship(back_populates="prestamo")
