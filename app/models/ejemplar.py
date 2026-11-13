from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import EstadoEjemplar

if TYPE_CHECKING:
    from app.models.libro import Libro
    from app.models.prestamo import Prestamo
    from app.models.sede import Sede


class Ejemplar(Base):
    __tablename__ = "ejemplar"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo_inventario: Mapped[str] = mapped_column(String(30), unique=True)
    signatura_topografica: Mapped[str | None] = mapped_column(String(50))
    descripcion_fisica: Mapped[str | None] = mapped_column(String(200))
    estado: Mapped[EstadoEjemplar] = mapped_column(
        Enum(EstadoEjemplar, native_enum=False), default=EstadoEjemplar.DISPONIBLE
    )
    libro_id: Mapped[int] = mapped_column(ForeignKey("libro.id"))
    sede_origen_id: Mapped[int] = mapped_column(ForeignKey("sede.id"))
    sede_actual_id: Mapped[int] = mapped_column(ForeignKey("sede.id"))

    libro: Mapped["Libro"] = relationship(back_populates="ejemplares")
    # Dos FK hacia la misma tabla: hay que indicar cual usa cada relationship.
    sede_origen: Mapped["Sede"] = relationship(foreign_keys=[sede_origen_id])
    sede_actual: Mapped["Sede"] = relationship(foreign_keys=[sede_actual_id])
    prestamos: Mapped[list["Prestamo"]] = relationship(back_populates="ejemplar")
