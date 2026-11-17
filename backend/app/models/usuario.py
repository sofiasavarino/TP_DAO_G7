from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BajaLogicaMixin

if TYPE_CHECKING:
    from app.models.empleado import Empleado
    from app.models.resena import Resena
    from app.models.rol import Rol
    from app.models.sede import Sede
    from app.models.socio import Socio


class Usuario(Base, BajaLogicaMixin):
    __tablename__ = "usuario"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre_usuario: Mapped[str] = mapped_column(String(50), unique=True)
    hash: Mapped[str] = mapped_column(String(255))
    rol_id: Mapped[int] = mapped_column(ForeignKey("rol.id"))
    sede_id: Mapped[int] = mapped_column(ForeignKey("sede.id"))

    rol: Mapped["Rol"] = relationship(back_populates="usuarios")
    sede: Mapped["Sede"] = relationship(back_populates="usuarios")
    # Un usuario es empleado O socio, nunca ambos: se valida en el service.
    empleado: Mapped[Optional["Empleado"]] = relationship(back_populates="usuario")
    socio: Mapped[Optional["Socio"]] = relationship(back_populates="usuario")
    resenas: Mapped[list["Resena"]] = relationship(back_populates="usuario")
