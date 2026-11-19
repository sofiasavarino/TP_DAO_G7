from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config.database import get_session
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
    renovar_prestamo,
)

prestamo_router = APIRouter(prefix="/prestamos", tags=["prestamos"])


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


@prestamo_router.get("", response_model=list[PrestamoListadoDTO])
def listar_prestamos(session: Session = Depends(get_session)) -> list[PrestamoListadoDTO]:
    """Listado general del bibliotecario. El handler no toca SQL ni ORM."""
    return listar_todos(session)


@prestamo_router.get("/mios", response_model=list[PrestamoListadoDTO])
def listar_prestamos_mios(
    socio_id: int, session: Session = Depends(get_session)
) -> list[PrestamoListadoDTO]:
    """Préstamos del socio autenticado (o indicado). Sin auth todavía, requiere `?socio_id=`."""
    return listar_mios(session, socio_id)


@prestamo_router.get("/vencidos", response_model=list[PrestamoListadoDTO])
def listar_prestamos_vencidos(
    session: Session = Depends(get_session),
) -> list[PrestamoListadoDTO]:
    """Préstamos actualmente vencidos (estado VENCIDO)."""
    return listar_vencidos(session)


@prestamo_router.post("", response_model=PrestamoDTO, status_code=201)
def crear_prestamo_endpoint(
    datos: PrestamoCreate, session: Session = Depends(get_session)
) -> PrestamoDTO:
    try:
        prestamo = crear_prestamo(session, datos)
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e
    session.commit()
    return PrestamoDTO.model_validate(prestamo)


@prestamo_router.put("/{prestamo_id}/devolucion", response_model=PrestamoDTO)
def devolver_prestamo_endpoint(
    prestamo_id: int,
    sede_id: int = Query(..., description="Sede donde el socio devuelve el ejemplar"),
    responsable_devolucion_id: int = Query(..., description="Usuario bibliotecario/empleado que recibe la devolución"),
    session: Session = Depends(get_session),
) -> PrestamoDTO:
    try:
        prestamo = devolver_prestamo(session, prestamo_id, sede_id=sede_id, usuario_id=responsable_devolucion_id)
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e
    session.commit()
    return PrestamoDTO.model_validate(prestamo)


@prestamo_router.put("/{prestamo_id}/renovacion", response_model=PrestamoDTO)
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
