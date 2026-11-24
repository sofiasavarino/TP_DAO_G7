"""Reportes de gestión: capa de presentación de agregados ya resueltos en los repositorios.

Los reportes son de solo lectura y no contienen reglas de negocio: consultan, calculan
porcentajes/promedios y devuelven DTOs listos para graficar.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

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
    MultaSocioDTO,
    PresionLibroDTO,
    UsoGeneroSedeDTO,
    VencidoSinSancionDTO,
    VencidosSinSancionDTO,
)
from app.models.enums import EstadoEjemplar, EstadoRemito, EstadoReserva, TipoPrestamo
from app.repositories.ejemplar_repository import EjemplarRepository
from app.repositories.libro_repository import LibroRepository
from app.repositories.prestamo_repository import PrestamoRepository
from app.repositories.reserva_repository import ReservaRepository
from app.repositories.remito_repository import RemitoRepository
from app.repositories.sancion_repository import SancionRepository

ejemplar_repo = EjemplarRepository()
libro_repo = LibroRepository()
prestamo_repo = PrestamoRepository()
reserva_repo = ReservaRepository()
remito_repo = RemitoRepository()
sancion_repo = SancionRepository()


def _pct(parte: int, total: int) -> float:
    return round(parte / total * 100, 2) if total else 0.0


def _promedio(valor: float | None) -> float | None:
    return round(valor, 2) if valor is not None else None


# -------------------------------------------------------------------- reportes


def disponibilidad_por_sede(
    session: Session, libro_id: int | None = None
) -> list[DisponibilidadSedeDTO]:
    """% de ejemplares disponibles por sede (de los no-inutilizables)."""
    return [
        DisponibilidadSedeDTO(
            sede_id=row._mapping["id"],
            sede=row._mapping["nombre"],
            disponibles=row._mapping["disponibles"],
            total=row._mapping["total"],
            porcentaje=_pct(row._mapping["disponibles"], row._mapping["total"]),
        )
        for row in ejemplar_repo.disponibilidad_por_sede(session, libro_id)
    ]


def eficacia_logistica(
    session: Session, desde: date | None = None, hasta: date | None = None
) -> EficaciaLogisticaDTO:
    """Tasa de remitos recibidos correctamente sobre los cerrados (recibidos + incidencia)."""
    conteo = remito_repo.conteo_por_estado(session, desde, hasta)
    creados = conteo.get(EstadoRemito.CREADO, 0)
    en_transito = conteo.get(EstadoRemito.EN_TRANSITO, 0)
    recibidos = conteo.get(EstadoRemito.RECIBIDO, 0)
    con_incidencia = conteo.get(EstadoRemito.CON_INCIDENCIA, 0)
    finalizados = recibidos + con_incidencia
    return EficaciaLogisticaDTO(
        creados=creados,
        en_transito=en_transito,
        recibidos=recibidos,
        con_incidencia=con_incidencia,
        finalizados=finalizados,
        tasa_exito_porcentaje=_pct(recibidos, finalizados),
    )


def movimientos_entre_sedes(
    session: Session, desde: date | None = None, hasta: date | None = None
) -> list[MovimientoSedeDTO]:
    """Envíos por origen/destino y tiempo medio de tránsito (días)."""
    return [
        MovimientoSedeDTO(
            origen=row._mapping["origen"],
            destino=row._mapping["destino"],
            remitos=row._mapping["remitos"],
            ejemplares=row._mapping["ejemplares"],
            dias_promedio=_promedio(row._mapping["dias_promedio"]),
        )
        for row in remito_repo.movimientos_entre_sedes(session, desde, hasta)
    ]


def libros_mas_solicitados(
    session: Session,
    tipo: TipoPrestamo | None = None,
    limite: int = 10,
) -> list[LibroSolicitadoDTO]:
    """Ranking de préstamos por libro (por defecto, todos los tipos)."""
    return [
        LibroSolicitadoDTO(
            libro_id=row._mapping["id"],
            libro=row._mapping["nombre"],
            cantidad=row._mapping["cantidad"],
        )
        for row in libro_repo.mas_solicitados(session, tipo, limite)
    ]


def salud_coleccion(session: Session) -> list[EstadoColeccionDTO]:
    """Distribución de ejemplares por estado (material fuera de circulación)."""
    conteo = ejemplar_repo.conteo_por_estado(session)
    total = sum(conteo.values())
    return [
        EstadoColeccionDTO(
            estado=estado.value,
            cantidad=conteo.get(estado, 0),
            porcentaje=_pct(conteo.get(estado, 0), total),
        )
        for estado in EstadoEjemplar
    ]


def cumplimiento_retiro(
    session: Session, desde: date | None = None, hasta: date | None = None
) -> CumplimientoRetiroDTO:
    """% de reservas cerradas por retiro efectivo sobre las que llegaron a su fin."""
    conteo = reserva_repo.conteo_por_estado(session, desde, hasta)
    cumplidas = conteo.get(EstadoReserva.CUMPLIDA, 0)
    vencidas = conteo.get(EstadoReserva.VENCIDA, 0)
    canceladas = conteo.get(EstadoReserva.CANCELADA, 0)
    return CumplimientoRetiroDTO(
        cumplidas=cumplidas,
        vencidas=vencidas,
        canceladas=canceladas,
        tasa_cumplimiento_porcentaje=_pct(cumplidas, cumplidas + vencidas + canceladas),
    )


def espera_de_reservas(
    session: Session, desde: date | None = None, hasta: date | None = None
) -> list[EsperaReservaDTO]:
    """Días promedio desde la reserva hasta la asignación, por sede de retiro."""
    return [
        EsperaReservaDTO(
            sede_id=row._mapping["sede_id"],
            sede=row._mapping["sede_nombre"],
            reservas=row._mapping["reservas"],
            dias_promedio=_promedio(row._mapping["dias_promedio"]),
        )
        for row in reserva_repo.dias_promedio_espera_por_sede(session, desde, hasta)
    ]


def carga_operativa_por_sede(session: Session) -> list[CargaSedeDTO]:
    """Préstamos activos y material en tránsito (remitos) por sede."""
    prestamos = {
        row._mapping["sede_id"]: row._mapping for row in prestamo_repo.activos_por_sede(session)
    }
    transito = {
        row._mapping["sede_id"]: row._mapping for row in remito_repo.en_transito_por_sede(session)
    }
    resultado = []
    for sede_id in sorted(set(prestamos) | set(transito)):
        prestamo = prestamos.get(sede_id)
        remito = transito.get(sede_id)
        fuente = prestamo if prestamo is not None else remito
        if fuente is None:  # no debería pasar: la sede sale de la unión de ambos mapas
            continue
        resultado.append(
            CargaSedeDTO(
                sede_id=sede_id,
                sede=fuente["sede"],
                prestamos_activos=prestamo["prestamos"] if prestamo else 0,
                remitos_en_transito=remito["remitos"] if remito else 0,
                ejemplares_en_transito=remito["ejemplares"] if remito else 0,
            )
        )
    return resultado


def multas_acumuladas(
    session: Session, desde: date | None = None, hasta: date | None = None
) -> MultasAcumuladasDTO:
    """Total de multas y ranking de socios por monto."""
    socios = [
        MultaSocioDTO(
            socio_id=row._mapping["id"],
            socio=f"{row._mapping['apellido']}, {row._mapping['nombre']}",
            cantidad=row._mapping["cantidad"],
            monto_total=round(row._mapping["monto_total"], 2),
        )
        for row in sancion_repo.multas_acumuladas_por_socio(session, desde, hasta)
    ]
    return MultasAcumuladasDTO(
        total=round(sum(s.monto_total for s in socios), 2), socios=socios
    )


def presion_por_libro(session: Session, limite: int = 10) -> list[PresionLibroDTO]:
    """Libros con más reservas en cola por cada ejemplar disponible en circulación."""
    return [
        PresionLibroDTO(
            libro_id=row._mapping["libro_id"],
            libro=row._mapping["libro"],
            reservas_esperando=row._mapping["reservas_esperando"],
            ejemplares=row._mapping["ejemplares"],
            ratio=round(row._mapping["reservas_esperando"] / row._mapping["ejemplares"], 2)
            if row._mapping["ejemplares"]
            else 0.0,
        )
        for row in reserva_repo.presion_por_libro(session, limite)
    ]


def uso_por_genero_sede(
    session: Session, desde: date | None = None, hasta: date | None = None
) -> list[UsoGeneroSedeDTO]:
    """Préstamos por género y sede (rotación del catálogo)."""
    return [
        UsoGeneroSedeDTO(
            genero=row._mapping["genero"],
            sede=row._mapping["sede"],
            prestamos=row._mapping["prestamos"],
        )
        for row in prestamo_repo.por_genero_y_sede(session, desde, hasta)
    ]


def vencidos_sin_sancion(session: Session) -> VencidosSinSancionDTO:
    """Préstamos vencidos a los que todavía no se les aplicó sanción."""
    prestamos = prestamo_repo.listar_vencidos_sin_sancion(session)
    return VencidosSinSancionDTO(
        cantidad=len(prestamos),
        prestamos=[
            VencidoSinSancionDTO(
                numero=prestamo.numero,
                socio=f"{prestamo.socio.apellido}, {prestamo.socio.nombre}",
                libro=prestamo.ejemplar.libro.nombre,
                fecha_vencimiento=prestamo.fecha_vencimiento,
            )
            for prestamo in prestamos
        ],
    )
