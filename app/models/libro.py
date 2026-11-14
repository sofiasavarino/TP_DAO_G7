from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Column, ForeignKey, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.autor import Autor
    from app.models.ejemplar import Ejemplar
    from app.models.reserva import Reserva
    from app.models.resena import Resena

# Tabla intermedia N a N entre libro y autor
libro_autor = Table(
    "libro_autor",
    Base.metadata,
    Column("libro_id", ForeignKey("libro.id"), primary_key=True),
    Column("autor_id", ForeignKey("autor.id"), primary_key=True),
)


class Libro(Base):
    __tablename__ = "libro"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(200))
    isbn: Mapped[str | None] = mapped_column(String(20), unique=True)
    cant_paginas: Mapped[int | None]
    editorial: Mapped[str | None] = mapped_column(String(100))
    fecha_publicacion: Mapped[date | None]

    autores: Mapped[list["Autor"]] = relationship(
        secondary=libro_autor, back_populates="libros"
    )
    ejemplares: Mapped[list["Ejemplar"]] = relationship(back_populates="libro")
    reservas: Mapped[list["Reserva"]] = relationship(back_populates="libro")
    resenas: Mapped[list["Resena"]] = relationship(back_populates="libro")
