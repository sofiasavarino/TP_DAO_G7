from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_session
from app.dtos.googlebooks_dto import LibroLookupDTO
from app.services.libro_service import buscar_libro_por_isbn

libro_router = APIRouter(prefix="/libros", tags=["libros"])

SessionDep = Annotated[Session, Depends(get_session)]

@libro_router.get("/lookup", response_model=LibroLookupDTO)
def lookup_libro(isbn: str, session: SessionDep) -> LibroLookupDTO:
    """Autocompletado de datos de libro a partir del ISBN.

    Precedencia: DB local → Google Books → vacío (carga manual).
    """
    return buscar_libro_por_isbn(session, isbn)
