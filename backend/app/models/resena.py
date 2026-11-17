from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.libro import Libro
    from app.models.usuario import Usuario


class Resena(Base):
    __tablename__ = "resena"

    id: Mapped[int] = mapped_column(primary_key=True)
    descripcion: Mapped[str | None] = mapped_column(String(1000))
    puntuacion: Mapped[int]

    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuario.id"))
    libro_id: Mapped[int] = mapped_column(ForeignKey("libro.id"))

    usuario: Mapped["Usuario"] = relationship(back_populates="resenas")
    libro: Mapped["Libro"] = relationship(back_populates="resenas")
