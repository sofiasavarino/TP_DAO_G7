from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config.database import get_session
from app.dtos.prestamo_dto import PrestamoDTO
from app.dtos.reserva_dto import ReservaCreate, ReservaDTO, ReservaEtaDTO
from app.exceptions import BibliotecaError, LibroNoEncontrado, RemitoNoEncontrado, ReservaNoEncontrada
from app.models.enums import TipoPrestamo
from app.services.reserva_service import (
    cancelar_reserva,
    crear_reserva,
    eta_para_reserva,
    listar_mios,
    listar_pendientes,
    procesar_retiro,
    procesar_vencimientos,
)

reserva_router = APIRouter(prefix="/reservas", tags=["reservas"])


def _mapear_excepcion(e: Exception) -> HTTPException:
    # Capa controller: sin lógica de negocio, mapea dominio → HTTP.
    if isinstance(e, (RemitoNoEncontrado, LibroNoEncontrado, ReservaNoEncontrada)):
        return HTTPException(404, str(e))
    if isinstance(e, BibliotecaError):
        return HTTPException(409, str(e))
    if isinstance(e, ValueError):
        return HTTPException(400, str(e))
    return HTTPException(500, "error interno inesperado")


@reserva_router.post("", response_model=ReservaDTO, status_code=201)
def crear_reserva_endpoint(
    datos: ReservaCreate,
    responsable_creacion_id: int = Query(..., description="Usuario que da de alta la reserva (mostrador o sistema)"),
    session: Session = Depends(get_session),
) -> ReservaDTO:
    try:
        reserva = crear_reserva(session, datos, usuario_id=responsable_creacion_id)
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e
    session.commit()
    return ReservaDTO.model_validate(reserva)


@reserva_router.get("/mios", response_model=list[ReservaDTO])
def listar_mios_endpoint(
    socio_id: int = Query(..., description="Socio cuyas reservas se muestran"),
    session: Session = Depends(get_session),
) -> list[ReservaDTO]:
    """Reservas del socio del más reciente al más viejo (cualquier estado)."""
    try:
        return listar_mios(session, socio_id)
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e


@reserva_router.get("/pendientes", response_model=list[ReservaDTO])
def listar_pendientes_endpoint(
    libro_id: int | None = Query(None, description="Filtrar por libro (cola de espera del título)"),
    sede_id: int | None = Query(None, description="Filtrar por sede de retiro"),
    session: Session = Depends(get_session),
) -> list[ReservaDTO]:
    """Cola de espera SIN ejemplar (PENDIENTE) de toda la red, FIFO. Filtrable por libro o sede."""
    return listar_pendientes(session, libro_id=libro_id, sede_id=sede_id)


@reserva_router.get("/eta", response_model=ReservaEtaDTO)
def eta_reserva_endpoint(
    libro_id: int = Query(..., description="Libro por el que se pregunta"),
    sede_retiro_id: int = Query(..., description="Sede en que el socio retiraría"),
    session: Session = Depends(get_session),
) -> ReservaEtaDTO:
    """Vista previa SIN crear la reserva: ¿lo tiene ahora o para cuándo?

    Lo usa el front antes de que el socio confirme la reserva.
    """
    return eta_para_reserva(session, libro_id, sede_retiro_id)


@reserva_router.delete("/{reserva_id}", response_model=ReservaDTO)
def cancelar_reserva_endpoint(
    reserva_id: int,
    responsable_cancelacion_id: int = Query(..., description="Usuario que cancela (mostrador o socios)"),
    session: Session = Depends(get_session),
) -> ReservaDTO:
    """Cancelación de reserva viva (PENDIENTE / EN_TRANSITO / LISTA_PARA_RETIRO).

    Si el ejemplar estaba pre-asignado y no viaja en un remito, se libera y pasa a la
    siguiente reserva en fila; si viajaba, se reasigna al llegar al destino.
    """
    try:
        reserva = cancelar_reserva(session, reserva_id, usuario_id=responsable_cancelacion_id)
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e
    session.commit()
    return ReservaDTO.model_validate(reserva)


@reserva_router.post("/procesar-vencimientos", response_model=list[ReservaDTO])
def procesar_vencimientos_endpoint(
    responsable_proceso_id: int = Query(..., description="Usuario que dispara el procesamiento (admin/bibliotecario)"),
    session: Session = Depends(get_session),
) -> list[ReservaDTO]:
    """Cierra las reservas LISTA_PARA_RETIRO cuya ventana de retiro ya pasó.

    Cada una pasa a VENCIDA; el ejemplar se libera y se sirve la siguiente reserva
    más vieja FIFO del libro. Devuelve las reservas que vencieron.
    """
    try:
        vencidas = procesar_vencimientos(session, usuario_id=responsable_proceso_id)
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e
    session.commit()
    return [ReservaDTO.model_validate(r) for r in vencidas]


@reserva_router.post("/{reserva_id}/retira", response_model=PrestamoDTO, status_code=201)
def retira_reserva_endpoint(
    reserva_id: int,
    sede_id: int = Query(..., description="Sede donde el socio retira (debe ser la sede de retiro de la reserva)"),
    responsable_retiro_id: int = Query(..., description="Usuario que confirma el retiro (bibliotecario)"),
    tipo: TipoPrestamo = Query(TipoPrestamo.LOCAL, description="Tipo de préstamo que nace del retiro"),
    session: Session = Depends(get_session),
) -> PrestamoDTO:
    try:
        prestamo = procesar_retiro(
            session,
            reserva_id,
            sede_id=sede_id,
            usuario_id=responsable_retiro_id,
            tipo=tipo,
        )
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e
    session.commit()
    return PrestamoDTO.model_validate(prestamo)
