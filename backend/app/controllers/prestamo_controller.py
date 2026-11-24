from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config.database import get_session
from app.controllers.dependencies import BIBLIOTECARIO, get_current_user, require_roles
from app.dtos.ejemplar_dto import EjemplarCreate
from app.dtos.prestamo_dto import PrestamoCreate, PrestamoDTO, PrestamoListadoDTO
from app.exceptions import (
    BibliotecaError,
    EjemplarNoDisponible,
    LimitePrestamosExcedido,
    SocioSancionado,
)
from app.services.prestamo_service import (
    crear_prestamo,
    devolver_prestamo,
    listar_mios,
    listar_todos,
    listar_vencidos,
    marcar_perdido,
    renovar_prestamo,
    reponer_libro,
)

prestamo_router = APIRouter(
    prefix="/prestamos", tags=["prestamos"], dependencies=[Depends(get_current_user)]
)


def _mapear_excepcion(e: Exception) -> HTTPException:
    """Domain → HTTP: dominio a controlador, controlador a HTTP.

    Responsabilidad del controller (esta capa): llamar al service, recoger la excepción
    de dominio, mapearla a status+detail. Sin conocer SQL ni ORM; sin lógica de negocio.
    """
    if isinstance(e, LimitePrestamosExcedido):
        return HTTPException(409, str(e))
    if isinstance(e, SocioSancionado):
        return HTTPException(403, str(e))
    if isinstance(e, BibliotecaError):
        return HTTPException(409, str(e))
    if isinstance(e, EjemplarNoDisponible):
        return HTTPException(409, str(e))
    if isinstance(e, ValueError):
        return HTTPException(400, str(e))
    return HTTPException(500, "error interno inesperado")


@prestamo_router.get(
    "", response_model=list[PrestamoListadoDTO],
    dependencies=[Depends(require_roles(BIBLIOTECARIO))],
)
def listar_prestamos(session: Session = Depends(get_session)) -> list[PrestamoListadoDTO]:
    """Listado general del bibliotecario. El handler no toca SQL ni ORM."""
    return listar_todos(session)


@prestamo_router.get("/mios", response_model=list[PrestamoListadoDTO])
def listar_prestamos_mios(
    socio_id: int, session: Session = Depends(get_session)
) -> list[PrestamoListadoDTO]:
    """Préstamos del socio autenticado (o indicado). Sin auth todavía, requiere `?socio_id=`."""
    return listar_mios(session, socio_id)


@prestamo_router.get(
    "/vencidos", response_model=list[PrestamoListadoDTO],
    dependencies=[Depends(require_roles(BIBLIOTECARIO))],
)
def listar_prestamos_vencidos(
    session: Session = Depends(get_session),
) -> list[PrestamoListadoDTO]:
    """Préstamos actualmente vencidos (estado VENCIDO)."""
    return listar_vencidos(session)


@prestamo_router.post(
    "", response_model=PrestamoDTO, status_code=201,
    dependencies=[Depends(require_roles(BIBLIOTECARIO))],
)
def crear_prestamo_endpoint(
    datos: PrestamoCreate, session: Session = Depends(get_session)
) -> PrestamoDTO:
    try:
        prestamo = crear_prestamo(session, datos)
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e
    session.commit()
    return PrestamoDTO.model_validate(prestamo)


@prestamo_router.put(
    "/{prestamo_id}/devolucion", response_model=PrestamoDTO,
    dependencies=[Depends(require_roles(BIBLIOTECARIO))],
)
def devolver_prestamo_endpoint(
    prestamo_id: int,
    sede_id: int = Query(..., description="Sede donde el socio devuelve el ejemplar"),
    responsable_devolucion_id: int = Query(..., description="Usuario bibliotecario/empleado que recibe la devolución"),
    con_danios: bool = Query(False, description="Devuelto con daños menores: va a reparación y suspende al socio"),
    observaciones: str | None = Query(None, max_length=200, description="Estado físico del ejemplar al devolverlo"),
    session: Session = Depends(get_session),
) -> PrestamoDTO:
    try:
        prestamo = devolver_prestamo(
            session,
            prestamo_id,
            sede_id=sede_id,
            usuario_id=responsable_devolucion_id,
            con_danios=con_danios,
            observaciones=observaciones,
        )
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e
    session.commit()
    return PrestamoDTO.model_validate(prestamo)


@prestamo_router.put(
    "/{prestamo_id}/renovacion", response_model=PrestamoDTO,
    dependencies=[Depends(require_roles(BIBLIOTECARIO))],
)
def renovar_prestamo_endpoint(
    prestamo_id: int,
    session: Session = Depends(get_session),
) -> PrestamoDTO:
    try:
        prestamo = renovar_prestamo(session, prestamo_id)
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e
    session.commit()
    return PrestamoDTO.model_validate(prestamo)


@prestamo_router.put(
    "/{prestamo_id}/perdida", response_model=PrestamoDTO,
    dependencies=[Depends(require_roles(BIBLIOTECARIO))],
)
def marcar_perdido_endpoint(
    prestamo_id: int,
    responsable_id: int = Query(..., description="Usuario bibliotecario/empleado que da por perdido el ejemplar"),
    session: Session = Depends(get_session),
) -> PrestamoDTO:
    """Da por perdido el ejemplar de un préstamo que nunca se devolvió (a mano, en el mostrador).

    El ejemplar pasa a PERDIDO, el socio a BAJA y se crea la sanción REPOSICION.
    """
    try:
        prestamo = marcar_perdido(session, prestamo_id, usuario_id=responsable_id)
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e
    session.commit()
    return PrestamoDTO.model_validate(prestamo)


@prestamo_router.put(
    "/{prestamo_id}/reposicion", response_model=PrestamoDTO,
    dependencies=[Depends(require_roles(BIBLIOTECARIO))],
)
def reponer_libro_endpoint(
    prestamo_id: int,
    datos: EjemplarCreate,
    responsable_id: int = Query(..., description="Usuario bibliotecario/empleado que recibe la reposición"),
    session: Session = Depends(get_session),
) -> PrestamoDTO:
    """El socio entrega una copia de reposición (mismo libro o edición posterior).

    Se da de alta el ejemplar nuevo, el perdido pasa a INUTILIZABLE, el préstamo se finaliza
    y el socio vuelve a ACTIVO.
    """
    try:
        prestamo = reponer_libro(session, prestamo_id, datos, usuario_id=responsable_id)
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e
    session.commit()
    return PrestamoDTO.model_validate(prestamo)
