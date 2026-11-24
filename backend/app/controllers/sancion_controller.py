from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config.database import get_session
from app.controllers.dependencies import BIBLIOTECARIO, get_current_user, require_roles
from app.dtos.sancion_dto import SancionCreate, SancionDTO
from app.exceptions import BibliotecaError
from app.services.sancion_service import abonar_multa, crear_sancion, levantar, listar_activas

sancion_router = APIRouter(
    prefix="/sanciones", tags=["sanciones"], dependencies=[Depends(get_current_user)]
)


def _mapear_excepcion(e: Exception) -> HTTPException:
    if isinstance(e, BibliotecaError):
        return HTTPException(409, str(e))
    if isinstance(e, ValueError):
        return HTTPException(400, str(e))
    return HTTPException(500, "error interno inesperado")


@sancion_router.post(
    "", response_model=SancionDTO, status_code=201,
    dependencies=[Depends(require_roles(BIBLIOTECARIO))],
)
def crear_sancion_endpoint(
    datos: SancionCreate,
    responsable_id: int = Query(..., description="Usuario bibliotecario/admin que aplica la sanción"),
    session: Session = Depends(get_session),
) -> SancionDTO:
    try:
        sancion = crear_sancion(session, datos, usuario_id=responsable_id)
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e
    session.commit()
    return SancionDTO.model_validate(sancion)


@sancion_router.get("", response_model=list[SancionDTO])
def listar_sanciones_endpoint(
    socio_id: int | None = Query(None, description="Filtrar por socio (si no se pasa, todas las activas)"),
    session: Session = Depends(get_session),
) -> list[SancionDTO]:
    """Sanciones vigentes hoy. Filtrable por socio."""
    return [SancionDTO.model_validate(s) for s in listar_activas(session, socio_id=socio_id)]


@sancion_router.get(
    "/{socio_id}", response_model=list[SancionDTO],
    dependencies=[Depends(require_roles(BIBLIOTECARIO))],
)
def listar_sanciones_socio_endpoint(
    socio_id: int, session: Session = Depends(get_session)
) -> list[SancionDTO]:
    """Sanciones vigentes de un socio."""
    return [SancionDTO.model_validate(s) for s in listar_activas(session, socio_id=socio_id)]


@sancion_router.put(
    "/{sancion_id}/levantar", response_model=SancionDTO,
    dependencies=[Depends(require_roles(BIBLIOTECARIO))],
)
def levantar_sancion_endpoint(
    sancion_id: int,
    responsable_id: int = Query(..., description="Usuario bibliotecario/admin que levanta la sanción"),
    session: Session = Depends(get_session),
) -> SancionDTO:
    """Levanta (perdona) una sanción: cierra fecha_fin en hoy y el socio vuelve a poder reservar/prestar.

    Para COBRAR una multa usar `/abonar`, que además suspende al socio. La baja por pérdida
    (REPOSICION) no se levanta acá: se resuelve con la reposición del libro.
    """
    try:
        sancion = levantar(session, sancion_id, usuario_id=responsable_id)
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e
    session.commit()
    return SancionDTO.model_validate(sancion)


@sancion_router.put(
    "/{sancion_id}/abonar", response_model=SancionDTO,
    dependencies=[Depends(require_roles(BIBLIOTECARIO))],
)
def abonar_multa_endpoint(
    sancion_id: int,
    responsable_id: int = Query(..., description="Usuario bibliotecario/admin que registra el pago"),
    session: Session = Depends(get_session),
) -> SancionDTO:
    """Registra el pago de una multa y arranca la suspensión posterior (15 días desde hoy).

    Devuelve la suspensión creada; la multa queda levantada.
    """
    try:
        suspension = abonar_multa(session, sancion_id, usuario_id=responsable_id)
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e
    session.commit()
    return SancionDTO.model_validate(suspension)
