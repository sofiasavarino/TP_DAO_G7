from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config.database import get_session
from app.dtos.remito_dto import IncidenciaItemDTO, RemitoCreate, RemitoDetalleDTO, RemitoListadoDTO
from app.exceptions import BibliotecaError, RemitoNoEncontrado
from app.models.enums import EstadoRemito
from app.services.remito_service import (
    crear_remito,
    despachar,
    listar_con_incidencia,
    listar_pendientes_de_despacho,
    listar_pendientes_de_recepcion,
    listar_remitos,
    obtener_remito,
    recibir,
    to_detalle,
)

remito_router = APIRouter(prefix="/remitos", tags=["remitos"])


def _mapear_excepcion(e: Exception) -> HTTPException:
    # Capa controller: sin lógica de negocio, mapea dominio → HTTP.
    if isinstance(e, RemitoNoEncontrado):
        return HTTPException(404, str(e))
    if isinstance(e, BibliotecaError):
        return HTTPException(409, str(e))
    if isinstance(e, ValueError):
        return HTTPException(400, str(e))
    return HTTPException(500, "error interno inesperado")


@remito_router.post("", response_model=RemitoDetalleDTO, status_code=201)
def crear_remito_endpoint(
    datos: RemitoCreate,
    responsable_creacion_id: int = Query(..., description="Usuario que da de alta el remito"),
    session: Session = Depends(get_session),
) -> RemitoDetalleDTO:
    try:
        remito = crear_remito(session, datos, usuario_id=responsable_creacion_id)
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e
    session.commit()
    return to_detalle(session, remito.id)


@remito_router.get("", response_model=list[RemitoListadoDTO])
def listar_remitos_endpoint(
    estado: EstadoRemito | None = Query(None, description="Filtrar por estado (si no se pasa, todos)"),
    session: Session = Depends(get_session),
) -> list[RemitoListadoDTO]:
    """Listado general de remitos (F8.1), del más nuevo al más viejo."""
    return listar_remitos(session, estado=estado)


@remito_router.get("/de-despacho", response_model=list[RemitoListadoDTO])
def listar_de_despacho_endpoint(
    sede_id: int | None = Query(None, description="Solo los remitos CREADO cuyo origen es esta sede"),
    session: Session = Depends(get_session),
) -> list[RemitoListadoDTO]:
    """Tablero: remitos CREADO listos para despachar (filtrable por sede de origen)."""
    return listar_pendientes_de_despacho(session, sede_id=sede_id)


@remito_router.get("/de-recepcion", response_model=list[RemitoListadoDTO])
def listar_de_recepcion_endpoint(
    sede_id: int | None = Query(None, description="Solo los remitos EN_TRANSITO cuyo destino es esta sede"),
    session: Session = Depends(get_session),
) -> list[RemitoListadoDTO]:
    """Tablero: remitos EN_TRANSITO pendientes de recibir (filtrable por sede de destino)."""
    return listar_pendientes_de_recepcion(session, sede_id=sede_id)


@remito_router.get("/con-incidencia", response_model=list[RemitoListadoDTO])
def listar_con_incidencia_endpoint(
    sede_id: int | None = Query(None, description="Solo los remitos con incidencia cuyo destino es esta sede"),
    session: Session = Depends(get_session),
) -> list[RemitoListadoDTO]:
    """Tablero: remitos CON_INCIDENCIA recibidos con algún ejemplar dañado (filtrable por sede de destino)."""
    return listar_con_incidencia(session, sede_id=sede_id)


@remito_router.get("/{remito_id}", response_model=RemitoDetalleDTO)
def obtener_remito_endpoint(
    remito_id: int, session: Session = Depends(get_session)
) -> RemitoDetalleDTO:
    try:
        return obtener_remito(session, remito_id)
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e


@remito_router.put("/{remito_id}/despacho", response_model=RemitoDetalleDTO)
def despacho_remito_endpoint(
    remito_id: int,
    responsable_despacho_id: int = Query(..., description="Usuario que despacha (bibliotecario)"),
    session: Session = Depends(get_session),
) -> RemitoDetalleDTO:
    try:
        remito = despachar(session, remito_id, usuario_id=responsable_despacho_id)
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e
    session.commit()
    return to_detalle(session, remito.id)


@remito_router.put("/{remito_id}/recepcion", response_model=RemitoDetalleDTO)
def recepcion_remito_endpoint(
    remito_id: int,
    responsable_recepcion_id: int = Query(..., description="Usuario que recibe (bibliotecario)"),
    observaciones: str | None = Query(None, description="Observaciones libres de la recepción"),
    incidencias: list[IncidenciaItemDTO] | None = Body(
        default=None,
        description="Ejemplares dañados al recibir: [{'ejemplar_id': 4, 'estado': 'EN_REPARACION'}] (o 'INUTILIZABLE')",
    ),
    session: Session = Depends(get_session),
) -> RemitoDetalleDTO:
    # La recepción, por definición, ocurre en remito.sede_destino_id — eso lo valida el servicio.
    mapa = {i.ejemplar_id: i.estado for i in incidencias} if incidencias else None
    try:
        remito = recibir(
            session,
            remito_id,
            usuario_id=responsable_recepcion_id,
            incidencias=mapa,
            observaciones=observaciones,
        )
    except Exception as e:  # noqa: BLE001
        raise _mapear_excepcion(e) from e
    session.commit()
    return to_detalle(session, remito.id)
