from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import TipoSancion

if TYPE_CHECKING:
    from app.models.prestamo import Prestamo
    from app.models.socio import Socio


class Sancion(Base):
    __tablename__ = "sancion"

    id: Mapped[int] = mapped_column(primary_key=True)
    tipo: Mapped[TipoSancion] = mapped_column(Enum(TipoSancion, native_enum=False))
    fecha_inicio: Mapped[date] = mapped_column(default=date.today)
    fecha_fin: Mapped[date | None]
    motivo: Mapped[str] = mapped_column(String(300))
    # Segun el tipo se usa uno u otro; el service valida cual corresponde.
    monto: Mapped[float | None] = mapped_column(Numeric(10, 2, asdecimal=False))
    dias_suspension: Mapped[int | None]

    socio_id: Mapped[int] = mapped_column(ForeignKey("socio.id"))
    prestamo_id: Mapped[int] = mapped_column(ForeignKey("prestamo.id"))

    socio: Mapped["Socio"] = relationship(back_populates="sanciones")
    prestamo: Mapped["Prestamo"] = relationship(back_populates="sanciones")
