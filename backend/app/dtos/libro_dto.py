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
    imagen_url: str | None = None
    genero: str | None = None
    autor_ids: list[int] = []  # N:N; vacío = sin autor asignado todavía
    # Nombres de autores (ej. los que trae Google Books): se reutilizan los que ya
    # existen (sin distinguir mayúsculas) y se crean los que falten.
    autores: list[str] = []


class LibroUpdate(BaseModel):
    """Entrada: edición de un título (reemplaza todos los campos y los autores)."""

    nombre: str
    isbn: str | None = None
    cant_paginas: int | None = None
    editorial: str | None = None
    fecha_publicacion: date | None = None
    imagen_url: str | None = None
    genero: str | None = None
    autores: list[str] = []


class LibroDTO(BaseModel):
    """Salida: detalle completo del libro."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    isbn: str | None = None
    cant_paginas: int | None = None
    editorial: str | None = None
    fecha_publicacion: date | None = None
    imagen_url: str | None = None
    genero: str | None = None
    activo: bool = True
    autores: list[AutorDTO] = []


class LibroListadoDTO(BaseModel):
    """Salida de catálogo/backoffice."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    editorial: str | None = None
    isbn: str | None = None
    imagen_url: str | None = None
    genero: str | None = None
    activo: bool = True
    autores: list[AutorDTO] = []
