from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.dtos.googlebooks_dto import LibroLookupDTO
from app.dtos.libro_dto import LibroCreate, LibroListadoDTO, LibroUpdate
from app.exceptions.catalogo import (
    GoogleBooksNoDisponible,
    IsbnDuplicado,
    LibroConPrestamosActivos,
    LibroNoEncontrado,
)
from app.models.autor import Autor
from app.models.enums import EstadoEjemplar
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
    alta desde Google Books) con `es_nuevo=False`; si estaba dado de baja, se
    reactiva. Los `autor_ids` que no existan abortan la creación con ValueError
    para que la vista avise. Los `autores` (nombres) se reutilizan o se crean.
    """
    isbn = _normalizar_isbn(datos.isbn)
    if isbn:
        existente = libro_repo.get_by_isbn(session, isbn)
        if existente is not None:
            if not existente.activo:
                existente.activo = True
                session.flush()
            return existente, False

    nombre = datos.nombre.strip()
    if not nombre:
        raise ValueError("El libro tiene que tener un título.")

    libro = Libro(
        nombre=nombre,
        isbn=isbn,
        cant_paginas=datos.cant_paginas,
        editorial=datos.editorial,
        fecha_publicacion=datos.fecha_publicacion,
        imagen_url=datos.imagen_url,
        genero=datos.genero,
        autores=_resolver_autores(session, datos.autor_ids, datos.autores),
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


def actualizar_libro(session: Session, libro_id: int, datos: LibroUpdate) -> Libro:
    """Edición de un título (incluye los dados de baja). Reemplaza los autores.

    Lanza LibroNoEncontrado, IsbnDuplicado o ValueError (título vacío).
    """
    libro = libro_repo.get_by_id(
        session, libro_id, selectinload(Libro.autores), incluir_inactivos=True
    )
    if libro is None:
        raise LibroNoEncontrado(f"El libro {libro_id} no existe.")

    nombre = datos.nombre.strip()
    if not nombre:
        raise ValueError("El libro tiene que tener un título.")

    isbn = _normalizar_isbn(datos.isbn)
    if isbn and libro_repo.existe_isbn(session, isbn, excluir_id=libro.id):
        raise IsbnDuplicado(f"Ya hay otro libro con el ISBN {isbn}.")

    libro.nombre = nombre
    libro.isbn = isbn
    libro.cant_paginas = datos.cant_paginas
    libro.editorial = datos.editorial
    libro.fecha_publicacion = datos.fecha_publicacion
    libro.imagen_url = datos.imagen_url
    libro.genero = datos.genero
    libro.autores = _resolver_autores(session, [], datos.autores)
    session.flush()
    return libro


# Estados en los que un ejemplar está "en circulación" (lo tiene o lo espera un socio).
_ESTADOS_EN_CIRCULACION = (
    EstadoEjemplar.PRESTADO,
    EstadoEjemplar.RESERVADO,
    EstadoEjemplar.EN_TRANSITO,
)


def dar_de_baja_libro(session: Session, libro_id: int) -> Libro:
    """Baja lógica (activo = False): el libro deja de aparecer en el catálogo.

    No se permite si algún ejemplar está prestado, reservado o en tránsito.
    Lanza LibroNoEncontrado o LibroConPrestamosActivos.
    """
    libro = libro_repo.get_by_id(
        session, libro_id, selectinload(Libro.ejemplares), incluir_inactivos=True
    )
    if libro is None:
        raise LibroNoEncontrado(f"El libro {libro_id} no existe.")
    if any(e.estado in _ESTADOS_EN_CIRCULACION for e in libro.ejemplares):
        raise LibroConPrestamosActivos(
            "No se puede dar de baja: hay ejemplares prestados, reservados o en tránsito."
        )
    libro_repo.soft_delete(session, libro)
    return libro


def buscar_en_google(texto: str, max_resultados: int = 10) -> list[LibroLookupDTO]:
    """Proxy del buscador de Google Books para el formulario de alta.

    Si el texto parece un ISBN busca por `isbn:`; si no, búsqueda libre (título, autor...).
    Lanza GoogleBooksNoDisponible si falta la API key o Google no responde.
    """
    limpio = texto.strip()
    if not limpio:
        return []
    compacto = _normalizar_isbn(limpio) or ""
    consulta = f"isbn:{compacto}" if _parece_isbn(compacto) else limpio

    from app.integrations.googlebooks import buscar, item_a_libro_dto

    try:
        items = buscar(consulta, max_results=max_resultados)
    except RuntimeError as e:  # falta GOOGLE_BOOKS_API_KEY
        raise GoogleBooksNoDisponible(str(e)) from e
    except Exception as e:  # timeout, sin conexión, JSON inválido...
        raise GoogleBooksNoDisponible("No se pudo conectar con Google Books.") from e

    resultados = [item_a_libro_dto(item, origen="GOOGLE") for item in items]
    return [r for r in resultados if r.nombre]


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


# ------------------------------------------------------------------ auxiliares


def _normalizar_isbn(isbn: str | None) -> str | None:
    """Saca guiones y espacios; vacío -> None (así no choca el UNIQUE con strings vacíos)."""
    if not isbn:
        return None
    limpio = isbn.replace("-", "").replace(" ", "").strip()
    return limpio or None


def _parece_isbn(texto: str) -> bool:
    return len(texto) in (10, 13) and texto[:-1].isdigit() and (texto[-1].isdigit() or texto[-1] in "xX")


def _resolver_autores(session: Session, autor_ids: list[int], nombres: list[str]) -> list[Autor]:
    """Autores por id (deben existir) + por nombre (se reutilizan o se crean)."""
    autores: list[Autor] = []
    if autor_ids:
        encontrados = autor_repo.get_by_ids(session, autor_ids)
        faltantes = sorted(set(autor_ids) - {a.id for a in encontrados})
        if faltantes:
            raise ValueError(f"autores no encontrados: {faltantes}")
        autores.extend(encontrados)

    limpios = [n.strip() for n in nombres if n and n.strip()]
    if limpios:
        por_nombre = {a.nombre.strip().lower(): a for a in autor_repo.get_by_nombres(session, limpios)}
        for n in limpios:
            autor = por_nombre.setdefault(n.lower(), Autor(nombre=n))
            if autor not in autores:
                autores.append(autor)
    return autores
