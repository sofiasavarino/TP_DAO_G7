from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config.database import get_session
from app.dtos.googlebooks_dto import LibroLookupDTO
from app.dtos.libro_dto import LibroCreate, LibroDTO, LibroListadoDTO
from app.repositories.libro_repository import LibroRepository
from app.services.libro_service import (
    buscar_libro_por_isbn,
    buscar_libros,
    buscar_por_autor,
    buscar_por_titulo,
    crear_libro,
    listar_catalogo,
    listar_catalogo_filtrado,
    to_listado_dto,
)

libro_router = APIRouter(tags=["libros"])
libro_repo = LibroRepository()


@libro_router.get("/libros/lookup", response_model=LibroLookupDTO, include_in_schema=True)
def lookup_libro(isbn: str, session: Session = Depends(get_session)) -> LibroLookupDTO:
    """Autocompletado por ISBN: DB local → Google Books → MANUAL."""
    return buscar_libro_por_isbn(session, isbn)


ORDENES_VALIDOS = {"default", "populares", "recientes"}


@libro_router.get("/catalogo", response_model=list[LibroListadoDTO])
def listar_libros(
    texto: str | None = Query(None, description="Búsqueda parcial por título o ISBN"),
    autor: str | None = Query(None, description="Búsqueda parcial por nombre de autor"),
    genero: str | None = Query(None, description="Filtrar por género (exacto)"),
    sedes: list[int] = Query(default=[], description="IDs de sede donde debe haber al menos una copia disponible"),
    orden: str = Query("default", description="default | populares (préstamos) | recientes (fecha de publicación)"),
    session: Session = Depends(get_session),
) -> list[LibroListadoDTO]:
    if orden not in ORDENES_VALIDOS:
        raise HTTPException(400, f"orden debe ser uno de {sorted(ORDENES_VALIDOS)}")
    libros = listar_catalogo_filtrado(
        session, texto=texto, autor=autor, genero=genero, sedes=sedes or None, orden=orden
    )
    return [to_listado_dto(l) for l in libros]


@libro_router.get("/catalogo/{libro_id}", response_model=LibroDTO)
def obtener_libro(libro_id: int, session: Session = Depends(get_session)) -> LibroDTO:
    libro = libro_repo.get_by_id(session, libro_id, incluir_inactivos=True)
    if libro is None:
        raise HTTPException(404, f"libro {libro_id} no existe")
    return LibroDTO.model_validate(libro)


@libro_router.get("/libros/buscar", response_model=list[LibroListadoDTO])
def buscar_libros_endpoint(texto: str, session: Session = Depends(get_session)) -> list[LibroListadoDTO]:
    if not texto.strip():
        return []
    return [to_listado_dto(l) for l in buscar_libros(session, texto)]


@libro_router.get("/libros/buscar/titulo", response_model=list[LibroListadoDTO])
def buscar_por_titulo_endpoint(titulo: str, session: Session = Depends(get_session)) -> list[LibroListadoDTO]:
    return [to_listado_dto(l) for l in buscar_por_titulo(session, titulo)]


@libro_router.get("/libros/buscar/autor", response_model=list[LibroListadoDTO])
def buscar_por_autor_endpoint(autor: str, session: Session = Depends(get_session)) -> list[LibroListadoDTO]:
    return [to_listado_dto(l) for l in buscar_por_autor(session, autor)]


@libro_router.post("/libros", response_model=LibroDTO, status_code=201)
def crear_libro_endpoint(datos: LibroCreate, session: Session = Depends(get_session)) -> LibroDTO:
    try:
        libro, fue_nuevo = crear_libro(session, datos)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    session.commit()
    return LibroDTO.model_validate(libro)
