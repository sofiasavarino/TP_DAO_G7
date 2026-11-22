from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.dtos.googlebooks_dto import LibroLookupDTO
from app.dtos.libro_dto import LibroCreate, LibroListadoDTO
from app.models.autor import Autor
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
        genero=datos.genero,
        autores=autores,
    )
    return libro_repo.add(session, libro), True


def crear_libro_desde_lookup(session: Session, datos: LibroLookupDTO) -> tuple[Libro, bool]:
    """Alta desde un resultado de Google Books (o MANUAL).

    - Dedup por ISBN: si ya existe, devuelve el libro actual con `es_nuevo=False`.
    - Resuelve autores por nombre (case-insensitive); crea los que falten.
    """
    nombre = (datos.nombre or "").strip()
    if not nombre:
        raise ValueError("El libro no tiene nombre.")

    if datos.isbn:
        existente = libro_repo.get_by_isbn(session, datos.isbn)
        if existente is not None:
            return existente, False
    else:
        # Sin ISBN no podemos deduplicar por eso; comparamos por nombre para que
        # la importación masiva sea idempotente.
        stmt = select(Libro).where(func.lower(Libro.nombre) == nombre.lower())
        existente = session.scalars(stmt).first()
        if existente is not None:
            return existente, False

    nombres = list(dict.fromkeys(a.strip() for a in datos.autores if a and a.strip()))
    encontrados = autor_repo.get_by_nombres(session, nombres)
    existe_lower = {a.nombre.strip().lower() for a in encontrados}
    autores = list(encontrados)
    for n in nombres:
        if n.lower() not in existe_lower:
            autores.append(Autor(nombre=n))

    libro = Libro(
        nombre=nombre,
        isbn=datos.isbn,
        cant_paginas=datos.cant_paginas,
        editorial=datos.editorial,
        fecha_publicacion=datos.fecha_publicacion,
        imagen_url=datos.imagen_url,
        genero=datos.genero,
        autores=autores,
    )
    return libro_repo.add(session, libro), True


def listar_catalogo_filtrado(
    session: Session,
    *,
    titulo: str | None = None,
    isbn: str | None = None,
    autor: str | None = None,
    genero: str | None = None,
    sedes: list[int] | None = None,
    orden: str = "default",
) -> list[Libro]:
    """Catálogo filtrable por título, ISBN y/o autor (parciales), género, disponibilidad
    por sede y orden. Todos opcionales y combinables (AND)."""
    return libro_repo.listar_catalogo_filtrado(
        session, titulo=titulo, isbn=isbn, autor=autor, genero=genero,
        sedes=sedes, orden=orden,
    )


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
        genero=libro.genero,
        autores=[a.nombre for a in libro.autores],  # lazy load dentro de la sesión
    )
