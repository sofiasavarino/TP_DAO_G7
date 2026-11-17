from sqlalchemy.orm import Session

from app.dtos.googlebooks_dto import LibroLookupDTO
from app.models.libro import Libro
from app.repositories import libro_repository


def buscar_libro_por_isbn(session: Session, isbn: str) -> LibroLookupDTO:
    """Precedencia: DB local → Google Books → MANUAL (maula rellenada)."""
    # 1) LOCAL: ¿ya lo tenemos?
    libro = libro_repository.get_by_isbn(session, isbn)
    if libro is not None:
        return _local_a_dto(libro)

    # 2) GOOGLE: consultamos la API
    try:
        from app.integrations.googlebooks import buscar_por_isbn
        from app.integrations.googlebooks.mapper import item_a_libro_dto

        item = buscar_por_isbn(isbn)
    except Exception:
        item = None
    if item:
        return item_a_libro_dto(item, origen="GOOGLE")

    # 3) MANUAL: no está ni en nuestra DB ni en Google
    return LibroLookupDTO(origen="MANUAL", isbn=isbn)


def _local_a_dto(libro: Libro) -> LibroLookupDTO:
    return LibroLookupDTO(
        origen="LOCAL",
        nombre=libro.nombre,
        isbn=libro.isbn,
        cant_paginas=libro.cant_paginas,
        editorial=libro.editorial,
        fecha_publicacion=libro.fecha_publicacion,
        imagen_url=libro.imagen_url,
        autores=[a.nombre for a in libro.autores],  # lazy load dentro de la sesión
    )
