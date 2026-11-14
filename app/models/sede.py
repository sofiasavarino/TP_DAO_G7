from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BajaLogicaMixin

if TYPE_CHECKING:
    from app.models.usuario import Usuario


class Sede(Base, BajaLogicaMixin):
    __tablename__ = "sede"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100))
    direccion: Mapped[str] = mapped_column(String(200))
    telefono: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(100))
    horario_atencion: Mapped[str | None] = mapped_column(String(200))
    fecha_creacion: Mapped[date] = mapped_column(default=date.today)

    usuarios: Mapped[list["Usuario"]] = relationship(back_populates="sede")
