from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.libro import Libro
    from app.models.socio import Socio


class Resena(Base):
    __tablename__ = "resena"

    id: Mapped[int] = mapped_column(primary_key=True)
    descripcion: Mapped[str | None] = mapped_column(String(1000))
    puntuacion: Mapped[int]

    socio_id: Mapped[int] = mapped_column(ForeignKey("socio.id"))
    libro_id: Mapped[int] = mapped_column(ForeignKey("libro.id"))

    socio: Mapped["Socio"] = relationship(back_populates="resenas")
    libro: Mapped["Libro"] = relationship(back_populates="resenas")
