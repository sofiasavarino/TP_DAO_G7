"""Lógica de negocio de sanciones.

La sanción por retraso ya se dispara automática en `prestamo_service.devolver_prestamo`
(`crear_sancion_por_retraso`). Este service cubre la sanción *manual* (alta por el
mostrador/admin), el listado de activas y el levantamiento.
"""

from datetime import date, timedelta

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.dtos.sancion_dto import SancionCreate, SancionDTO
from app.models.enums import EstadoSocio, TipoSancion
from app.models.sancion import Sancion
from app.models.socio import Socio
from app.repositories.prestamo_repository import PrestamoRepository
from app.repositories.sancion_repository import SancionRepository
from app.repositories.socio_repository import SocioRepository

sancion_repo = SancionRepository()
prestamo_repo = PrestamoRepository()
socio_repo = SocioRepository()


# ---------------------------------------------------------------------- operaciones


def crear_sancion(session: Session, datos: SancionCreate, usuario_id: int) -> Sancion:
    """Crea una sanción manual sobre el préstamo indicado.

    Valida:
    - el préstamo existe;
    - el socio del préstamo existe y está activo;
    - no existe ya una sanción para ese préstamo (no se sanciona dos veces el mismo);
    - tipo MULTA requiere `monto`; SUSPENSION requiere `dias_suspension` (valida el DTO).

    Para SUSPENSION se calcula `fecha_fin = fecha_inicio + dias_suspension` (hábiles).
    `usuario_id` es quien aplica la sanción (queda en observaciones).
    """
    prestamo = prestamo_repo.get_by_id(session, datos.prestamo_id)
    if prestamo is None:
        raise ValueError(f"préstamo {datos.prestamo_id} no existe")

    socio = socio_repo.get_by_id(session, prestamo.socio_id, incluir_inactivos=True)
    if socio is None:
        raise ValueError(f"socio {prestamo.socio_id} no existe")
    if socio.estado != EstadoSocio.ACTIVO:
        raise ValueError(f"socio {prestamo.socio_id} no está activo (estado: {socio.estado.value})")

    if sancion_repo.existe_para_prestamo(session, datos.prestamo_id):
        raise ValueError(f"el préstamo {datos.prestamo_id} ya tiene sanción")

    hoy = date.today()
    fecha_fin: date | None = None
    if datos.tipo == TipoSancion.SUSPENSION and datos.dias_suspension:
        fecha_fin = hoy + timedelta(days=datos.dias_suspension)

    sancion = Sancion(
        tipo=datos.tipo,
        fecha_inicio=datos.fecha_inicio or hoy,
        fecha_fin=fecha_fin,
        motivo=datos.motivo,
        monto=datos.monto,
        dias_suspension=datos.dias_suspension,
        socio_id=prestamo.socio_id,
        prestamo_id=datos.prestamo_id,
    )
    return sancion_repo.add(session, sancion)


def listar_activas(
    session: Session, socio_id: int | None = None, fecha: date | None = None
) -> list[Sancion]:
    """Sanciones vigentes hoy (o en `fecha`). Si se pasa `socio_id`, filtra por socio."""
    hoy = fecha or date.today()
    if socio_id is not None:
        return sancion_repo.listar_vigentes(session, socio_id, hoy)
    # Todas las activas sin filtro de socio (reporte/admin, baja frecuencia).
    stmt = (
        select(Sancion)
        .where(
            and_(
                Sancion.fecha_inicio <= hoy,
                or_(Sancion.fecha_fin.is_(None), Sancion.fecha_fin >= hoy),
            )
        )
        .order_by(Sancion.fecha_inicio.desc())
    )
    return list(session.scalars(stmt))


def levantar(session: Session, sancion_id: int, usuario_id: int) -> Sancion:
    """Levanta una sanción: la marca inactiva y cierra su `fecha_fin` en `hoy`.

    Devuelve la sanción actualizada. El socio vuelve a poder reservar/prestar
    inmediatamente (ya no tiene sanción vigente).
    """
    sancion = sancion_repo.get_by_id(session, sancion_id, incluir_inactivos=True)
    if sancion is None:
        raise ValueError(f"sanción {sancion_id} no existe")
    if not sancion.activo:
        raise ValueError(f"la sanción {sancion_id} ya está levantada")
    sancion.activo = False
    sancion.fecha_fin = date.today()
    session.flush()
    return sancion
