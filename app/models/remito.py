from datetime import date
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import EstadoRemito

if TYPE_CHECKING:
    from app.models.prestamo import Prestamo
    from app.models.sede import Sede
    from app.models.usuario import Usuario


class Remito(Base):
    __tablename__ = "remito"

    id: Mapped[int] = mapped_column(primary_key=True)
    numero_remito: Mapped[str] = mapped_column(String(20), unique=True)
    caracter_traslado: Mapped[str] = mapped_column(String(50))
    observaciones: Mapped[str | None] = mapped_column(Text)
    estado: Mapped[EstadoRemito] = mapped_column(
        Enum(EstadoRemito, native_enum=False), default=EstadoRemito.CREADO
    )
    fecha_creacion: Mapped[date] = mapped_column(default=date.today)
    fecha_despacho: Mapped[date | None]
    fecha_recepcion: Mapped[date | None]

    sede_origen_id: Mapped[int] = mapped_column(ForeignKey("sede.id"))
    sede_destino_id: Mapped[int] = mapped_column(ForeignKey("sede.id"))
    responsable_creacion_id: Mapped[int] = mapped_column(ForeignKey("usuario.id"))
    # Se completan despues de crear el remito, por eso son opcionales.
    responsable_despacho_id: Mapped[int | None] = mapped_column(ForeignKey("usuario.id"))
    responsable_recepcion_id: Mapped[int | None] = mapped_column(ForeignKey("usuario.id"))

    sede_origen: Mapped["Sede"] = relationship(foreign_keys=[sede_origen_id])
    sede_destino: Mapped["Sede"] = relationship(foreign_keys=[sede_destino_id])
    responsable_creacion: Mapped["Usuario"] = relationship(
        foreign_keys=[responsable_creacion_id]
    )
    responsable_despacho: Mapped[Optional["Usuario"]] = relationship(
        foreign_keys=[responsable_despacho_id]
    )
    responsable_recepcion: Mapped[Optional["Usuario"]] = relationship(
        foreign_keys=[responsable_recepcion_id]
    )

    prestamos_ida: Mapped[list["Prestamo"]] = relationship(
        foreign_keys="Prestamo.remito_ida_id", back_populates="remito_ida"
    )
    prestamos_devolucion: Mapped[list["Prestamo"]] = relationship(
        foreign_keys="Prestamo.remito_devolucion_id", back_populates="remito_devolucion"
    )
