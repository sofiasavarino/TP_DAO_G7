from datetime import date

from pydantic import BaseModel, ConfigDict

from app.dtos.autor_dto import AutorDTO


class LibroCreate(BaseModel):
    """Entrada: alta de título en el catálogo."""

    nombre: str
    isbn: str | None = None
    cant_paginas: int | None = None
    editorial: str | None = None
    fecha_publicacion: date | None = None
    autor_ids: list[int] = []  # N:N; vacío = sin autor asignado todavía


class LibroDTO(BaseModel):
    """Salida: detalle completo del libro."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    isbn: str | None = None
    cant_paginas: int | None = None
    editorial: str | None = None
    fecha_publicacion: date | None = None
    autores: list[AutorDTO] = []


class LibroListadoDTO(BaseModel):
    """Salida de catálogo/backoffice (incluye ejemplares que la app filtra por disponibilidad)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    editorial: str | None = None
    isbn: str | None = None
    autores: list[AutorDTO] = []
