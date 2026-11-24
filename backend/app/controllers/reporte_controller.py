"""Endpoints de reportes: solo lectura, restringidos al Administrador."""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config.database import get_session
from app.controllers.dependencies import ADMINISTRADOR, require_roles
from app.dtos.reporte_dto import (
    CargaSedeDTO,
    CumplimientoRetiroDTO,
    DisponibilidadSedeDTO,
    EficaciaLogisticaDTO,
    EstadoColeccionDTO,
    EsperaReservaDTO,
    LibroSolicitadoDTO,
    MovimientoSedeDTO,
    MultasAcumuladasDTO,
    PresionLibroDTO,
    UsoGeneroSedeDTO,
    VencidosSinSancionDTO,
)
from app.models.enums import TipoPrestamo
from app.reports import (
    carga_operativa_por_sede,
    cumplimiento_retiro,
    disponibilidad_por_sede,
    eficacia_logistica,
    espera_de_reservas,
    libros_mas_solicitados,
    movimientos_entre_sedes,
    multas_acumuladas,
    presion_por_libro,
    salud_coleccion,
    uso_por_genero_sede,
    vencidos_sin_sancion,
)

reporte_router = APIRouter(
    prefix="/reportes",
    tags=["reportes"],
    dependencies=[Depends(require_roles(ADMINISTRADOR))],
)


@reporte_router.get("/disponibilidad", response_model=list[DisponibilidadSedeDTO])
def disponibilidad_endpoint(
    libro_id: int | None = Query(None, description="Filtrar por libro (opcional)"),
    session: Session = Depends(get_session),
) -> list[DisponibilidadSedeDTO]:
    """% de ejemplares disponibles por sede."""
    return disponibilidad_por_sede(session, libro_id)


@reporte_router.get("/eficacia-logistica", response_model=EficaciaLogisticaDTO)
def eficacia_endpoint(
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    session: Session = Depends(get_session),
) -> EficaciaLogisticaDTO:
    """Tasa de remitos recibidos correctamente sobre los cerrados."""
    return eficacia_logistica(session, desde, hasta)


@reporte_router.get("/movimientos", response_model=list[MovimientoSedeDTO])
def movimientos_endpoint(
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    session: Session = Depends(get_session),
) -> list[MovimientoSedeDTO]:
    """Envíos por origen/destino y tiempo medio de tránsito."""
    return movimientos_entre_sedes(session, desde, hasta)


@reporte_router.get("/libros-solicitados", response_model=list[LibroSolicitadoDTO])
def libros_solicitados_endpoint(
    tipo: TipoPrestamo | None = Query(None, description="Filtrar por tipo de préstamo; vacío = todos"),
    limite: int = Query(10, ge=1, le=50),
    session: Session = Depends(get_session),
) -> list[LibroSolicitadoDTO]:
    """Libros más prestados (todos los tipos; opcionalmente filtrar por tipo)."""
    return libros_mas_solicitados(session, tipo, limite)


@reporte_router.get("/salud-coleccion", response_model=list[EstadoColeccionDTO])
def salud_endpoint(
    session: Session = Depends(get_session),
) -> list[EstadoColeccionDTO]:
    """Distribución del inventario por estado."""
    return salud_coleccion(session)


@reporte_router.get("/cumplimiento-retiro", response_model=CumplimientoRetiroDTO)
def cumplimiento_endpoint(
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    session: Session = Depends(get_session),
) -> CumplimientoRetiroDTO:
    """% de reservas cumplidas sobre las cerradas."""
    return cumplimiento_retiro(session, desde, hasta)


@reporte_router.get("/espera-reservas", response_model=list[EsperaReservaDTO])
def espera_endpoint(
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    session: Session = Depends(get_session),
) -> list[EsperaReservaDTO]:
    """Días promedio de espera hasta la asignación, por sede."""
    return espera_de_reservas(session, desde, hasta)


@reporte_router.get("/carga-operativa", response_model=list[CargaSedeDTO])
def carga_endpoint(
    session: Session = Depends(get_session),
) -> list[CargaSedeDTO]:
    """Préstamos activos y material en tránsito por sede."""
    return carga_operativa_por_sede(session)


@reporte_router.get("/multas", response_model=MultasAcumuladasDTO)
def multas_endpoint(
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    session: Session = Depends(get_session),
) -> MultasAcumuladasDTO:
    """Total de multas y ranking de socios por monto."""
    return multas_acumuladas(session, desde, hasta)


@reporte_router.get("/presion-libros", response_model=list[PresionLibroDTO])
def presion_endpoint(
    limite: int = Query(10, ge=1, le=50),
    session: Session = Depends(get_session),
) -> list[PresionLibroDTO]:
    """Libros con más reservas en cola por ejemplar en circulación."""
    return presion_por_libro(session, limite)


@reporte_router.get("/uso-genero", response_model=list[UsoGeneroSedeDTO])
def uso_endpoint(
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    session: Session = Depends(get_session),
) -> list[UsoGeneroSedeDTO]:
    """Préstamos por género y sede."""
    return uso_por_genero_sede(session, desde, hasta)


@reporte_router.get("/vencidos-sin-sancion", response_model=VencidosSinSancionDTO)
def vencidos_endpoint(
    session: Session = Depends(get_session),
) -> VencidosSinSancionDTO:
    """Préstamos vencidos que todavía no tienen sanción applied."""
    return vencidos_sin_sancion(session)
