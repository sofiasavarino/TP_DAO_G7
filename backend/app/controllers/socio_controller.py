from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config.database import get_session
from app.controllers.dependencies import BIBLIOTECARIO, require_roles
from app.dtos.socio_dto import SocioDTO
from app.services.socio_service import buscar_socios, listar_socios
from app.services.socio_service import habilitar_socio_cuota  # o sumala al import existente de socio_service

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

@socio_router.put("/{socio_id}/activar", response_model=SocioDTO)
def activar_socio_endpoint(
    socio_id: int,
    session: Session = Depends(get_session),
) -> SocioDTO:
    """Registra el pago de la cuota social y habilita al socio (PENDIENTE_CUOTA -> ACTIVO)."""
    try:
        dto = habilitar_socio_cuota(session, socio_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    session.commit()
    return dto
