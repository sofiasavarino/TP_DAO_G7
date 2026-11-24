from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config.database import get_session
from app.controllers.dependencies import BIBLIOTECARIO, get_current_user, require_roles
from app.dtos.googlebooks_dto import LibroLookupDTO
from app.dtos.libro_dto import LibroCreate, LibroDTO, LibroListadoDTO, LibroUpdate
from app.exceptions.catalogo import (
    GoogleBooksNoDisponible,
    IsbnDuplicado,
    LibroConPrestamosActivos,
    LibroNoEncontrado,
)
from app.repositories.libro_repository import LibroRepository
from app.services.libro_service import (
    actualizar_libro,
    buscar_en_google,
    buscar_libro_por_isbn,
    crear_libro,
    dar_de_baja_libro,
    listar_catalogo_filtrado,
    to_listado_dto,
)

libro_router = APIRouter(
    prefix="/libros", tags=["libros"], dependencies=[Depends(get_current_user)]
)
libro_repo = LibroRepository()


@libro_router.get("/lookup", response_model=LibroLookupDTO, include_in_schema=True)
def lookup_libro(isbn: str, session: Session = Depends(get_session)) -> LibroLookupDTO:
    """Autocompletado por ISBN: DB local → Google Books → MANUAL."""
    return buscar_libro_por_isbn(session, isbn)


@libro_router.get(
    "/google",
    response_model=list[LibroLookupDTO],
    dependencies=[Depends(require_roles(BIBLIOTECARIO))],
)
def buscar_google_books(
    q: str = Query(..., min_length=2, description="Título, autor o ISBN"),
    max_resultados: int = Query(10, ge=1, le=40),
) -> list[LibroLookupDTO]:
    """Proxy a Google Books para el alta de libros (la API key nunca sale del backend)."""
    try:
        return buscar_en_google(q, max_resultados)
    except GoogleBooksNoDisponible as e:
        raise HTTPException(503, str(e)) from e


ORDENES_VALIDOS = {"default", "populares", "recientes"}


@libro_router.get("/catalogo", response_model=list[LibroListadoDTO])
def listar_libros(
    titulo: str | None = Query(None, description="Búsqueda parcial por título"),
    isbn: str | None = Query(None, description="Búsqueda parcial por ISBN"),
    autor: str | None = Query(None, description="Búsqueda parcial por nombre de autor"),
    genero: str | None = Query(None, description="Filtrar por género (exacto)"),
    sedes: list[int] = Query(default=[], description="IDs de sede donde debe haber al menos una copia disponible"),
    orden: str = Query("default", description="default | populares (préstamos) | recientes (fecha de publicación)"),
    session: Session = Depends(get_session),
) -> list[LibroListadoDTO]:
    if orden not in ORDENES_VALIDOS:
        raise HTTPException(400, f"orden debe ser uno de {sorted(ORDENES_VALIDOS)}")
    libros = listar_catalogo_filtrado(
        session, titulo=titulo, isbn=isbn, autor=autor, genero=genero, sedes=sedes or None, orden=orden
    )
    return [to_listado_dto(l) for l in libros]


@libro_router.get("/catalogo/{libro_id}", response_model=LibroDTO)
def obtener_libro(libro_id: int, session: Session = Depends(get_session)) -> LibroDTO:
    libro = libro_repo.get_by_id(session, libro_id, incluir_inactivos=True)
    if libro is None:
        raise HTTPException(404, f"libro {libro_id} no existe")
    return LibroDTO.model_validate(libro)


@libro_router.post(
    "", response_model=LibroDTO, status_code=201,
    dependencies=[Depends(require_roles(BIBLIOTECARIO))],
)
def crear_libro_endpoint(datos: LibroCreate, session: Session = Depends(get_session)) -> LibroDTO:
    """Alta de libro. Si el ISBN ya existe, devuelve el existente (no duplica)."""
    try:
        libro, fue_nuevo = crear_libro(session, datos)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    session.commit()
    return LibroDTO.model_validate(libro)


@libro_router.put(
    "/{libro_id}",
    response_model=LibroDTO,
    dependencies=[Depends(require_roles(BIBLIOTECARIO))],
)
def actualizar_libro_endpoint(
    libro_id: int, datos: LibroUpdate, session: Session = Depends(get_session)
) -> LibroDTO:
    """Edición de un libro del catálogo (reemplaza datos y autores)."""
    try:
        libro = actualizar_libro(session, libro_id, datos)
    except LibroNoEncontrado as e:
        raise HTTPException(404, str(e)) from e
    except IsbnDuplicado as e:
        raise HTTPException(409, str(e)) from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    session.commit()
    return LibroDTO.model_validate(libro)


@libro_router.patch(
    "/{libro_id}/baja",
    response_model=LibroDTO,
    dependencies=[Depends(require_roles(BIBLIOTECARIO))],
)
def dar_de_baja_libro_endpoint(libro_id: int, session: Session = Depends(get_session)) -> LibroDTO:
    """Baja lógica (activo = False). 409 si hay ejemplares en circulación."""
    try:
        libro = dar_de_baja_libro(session, libro_id)
    except LibroNoEncontrado as e:
        raise HTTPException(404, str(e)) from e
    except LibroConPrestamosActivos as e:
        raise HTTPException(409, str(e)) from e
    session.commit()
    return LibroDTO.model_validate(libro)
