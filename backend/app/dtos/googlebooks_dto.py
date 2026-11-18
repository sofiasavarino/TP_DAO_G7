from datetime import date
from typing import Literal

from pydantic import BaseModel


class LibroLookupDTO(BaseModel):
    """Resultado del intento de autocompletar un libro por ISBN."""

    origen: Literal["LOCAL", "GOOGLE", "MANUAL"]
    nombre: str | None = None
    isbn: str | None = None
    cant_paginas: int | None = None
    editorial: str | None = None
    fecha_publicacion: date | None = None
    imagen_url: str | None = None
    genero: str | None = None
    autores: list[str] = []
