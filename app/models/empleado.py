from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BajaLogicaMixin

if TYPE_CHECKING:
    from app.models.sede import Sede
    from app.models.usuario import Usuario


class Empleado(Base, BajaLogicaMixin):
    __tablename__ = "empleado"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100))
    apellido: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(100), unique=True)
    legajo: Mapped[str] = mapped_column(String(20), unique=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuario.id"), unique=True)
    sede_id: Mapped[int] = mapped_column(ForeignKey("sede.id"))

    usuario: Mapped["Usuario"] = relationship(back_populates="empleado")
    sede: Mapped["Sede"] = relationship(back_populates="empleados")
