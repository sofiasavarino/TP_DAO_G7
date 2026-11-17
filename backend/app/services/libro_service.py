from sqlalchemy.orm import Session

from app.dtos.googlebooks_dto import LibroLookupDTO
from app.dtos.libro_dto import LibroCreate, LibroListadoDTO
from app.models.libro import Libro
from app.repositories.autor_repository import AutorRepository
from app.repositories.libro_repository import LibroRepository

libro_repo = LibroRepository()
autor_repo = AutorRepository()


def buscar_libro_por_isbn(session: Session, isbn: str) -> LibroLookupDTO:
    """Precedencia: DB local -> Google Books -> MANUAL (carga manual)."""
    # 1) LOCAL: ¿ya lo tenemos?
    libro = libro_repo.get_by_isbn(session, isbn)
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


def crear_libro(session: Session, datos: LibroCreate) -> tuple[Libro, bool]:
    """Crea un libro en el catálogo. Devuelve (libro, es_nuevo).

    Si el ISBN ya existe, no duplica: devuelve el libro existente (ideal para el
    alta desde Google Books) con `es_nuevo=False`. Los `autor_ids` que no existan
    abortan la creación con ValueError para que la vista avise.
    """
    if datos.isbn:
        existente = libro_repo.get_by_isbn(session, datos.isbn)
        if existente is not None:
            return existente, False

    autores = []
    if datos.autor_ids:
        encontrados = autor_repo.get_by_ids(session, datos.autor_ids)
        encontrados_ids = {a.id for a in encontrados}
        faltantes = sorted(set(datos.autor_ids) - encontrados_ids)
        if faltantes:
            raise ValueError(f"autores no encontrados: {faltantes}")
        autores = encontrados

    libro = Libro(
        nombre=datos.nombre,
        isbn=datos.isbn,
        cant_paginas=datos.cant_paginas,
        editorial=datos.editorial,
        fecha_publicacion=datos.fecha_publicacion,
        imagen_url=datos.imagen_url,
        autores=autores,
    )
    return libro_repo.add(session, libro), True


def listar_catalogo(session: Session) -> list[Libro]:
    """Catálogo con autores precargados (1 + 1 queries, sin N+1)."""
    return libro_repo.listar_catalogo(session)


def buscar_libros(session: Session, texto: str) -> list[Libro]:
    """Búsqueda libre por título, ISBN o nombre de autor."""
    return libro_repo.buscar(session, texto)


def buscar_por_titulo(session: Session, titulo: str) -> list[Libro]:
    return libro_repo.buscar_por_titulo(session, titulo)


def buscar_por_autor(session: Session, autor: str) -> list[Libro]:
    return libro_repo.buscar_por_autor(session, autor)


def to_listado_dto(libro: Libro) -> LibroListadoDTO:
    return LibroListadoDTO.model_validate(libro)


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
