from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import EstadoSocio

if TYPE_CHECKING:
    from app.models.prestamo import Prestamo
    from app.models.reserva import Reserva
    from app.models.sancion import Sancion
    from app.models.usuario import Usuario


class Socio(Base):
    __tablename__ = "socio"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100))
    apellido: Mapped[str] = mapped_column(String(100))
    dni: Mapped[str] = mapped_column(String(15), unique=True)
    email: Mapped[str] = mapped_column(String(100))
    telefono: Mapped[str | None] = mapped_column(String(30))
    estado: Mapped[EstadoSocio] = mapped_column(
        Enum(EstadoSocio, native_enum=False), default=EstadoSocio.ACTIVO
    )
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuario.id"), unique=True)

    usuario: Mapped["Usuario"] = relationship(back_populates="socio")
    prestamos: Mapped[list["Prestamo"]] = relationship(back_populates="socio")
    reservas: Mapped[list["Reserva"]] = relationship(back_populates="socio")
    sanciones: Mapped[list["Sancion"]] = relationship(back_populates="socio")
