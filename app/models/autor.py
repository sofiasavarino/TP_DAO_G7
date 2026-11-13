from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BajaLogicaMixin

if TYPE_CHECKING:
    from app.models.libro import Libro


class Autor(Base, BajaLogicaMixin):
    __tablename__ = "autor"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150))

    libros: Mapped[list["Libro"]] = relationship(
        secondary="libro_autor", back_populates="autores"
    )
