from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config.database import get_session
from app.controllers.dependencies import BIBLIOTECARIO, require_roles
from app.dtos.socio_dto import SocioDTO
from app.services.socio_service import buscar_socios, listar_socios

socio_router = APIRouter(
    prefix="/socios", tags=["socios"], dependencies=[Depends(require_roles(BIBLIOTECARIO))]
)


@socio_router.get("", response_model=list[SocioDTO])
def buscar_socios_endpoint(
    q: str = Query("", description="Nombre, apellido o DNI (búsqueda parcial)"),
    session: Session = Depends(get_session),
) -> list[SocioDTO]:
    """Sin `q`: padrón completo con su estado (F8.3).
    Con `q`: buscador del mostrador por nombre, apellido o DNI (F7.2), sin los dados de baja."""
    if not q.strip():
        return listar_socios(session)
    return buscar_socios(session, q)
