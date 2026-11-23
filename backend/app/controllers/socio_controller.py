from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config.database import get_session
from app.dtos.socio_dto import SocioDTO
from app.services.socio_service import buscar_socios

socio_router = APIRouter(prefix="/socios", tags=["socios"])


@socio_router.get("", response_model=list[SocioDTO])
def buscar_socios_endpoint(
    q: str = Query("", description="Nombre, apellido o DNI (búsqueda parcial)"),
    session: Session = Depends(get_session),
) -> list[SocioDTO]:
    """Buscador de socios del mostrador (F7.2): elegir a quién se le presta."""
    return buscar_socios(session, q)
