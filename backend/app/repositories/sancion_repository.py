from datetime import date

from sqlalchemy import Row, and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.enums import TipoSancion
from app.models.sancion import Sancion
from app.models.socio import Socio
from app.repositories.base_repository import BaseRepository


def _vigente_en(fecha: date):
    """Condicion SQL: la sancion ya empezo y no termino (fecha_fin nula = sin fin)."""
    return and_(
        Sancion.fecha_inicio <= fecha,
        or_(Sancion.fecha_fin.is_(None), Sancion.fecha_fin >= fecha),
    )


class SancionRepository(BaseRepository[Sancion]):
    model = Sancion

    def listar_por_socio(self, session: Session, socio_id: int) -> list[Sancion]:
        stmt = (
            select(Sancion)
            .where(Sancion.socio_id == socio_id)
            .options(selectinload(Sancion.prestamo))
            .order_by(Sancion.fecha_inicio.desc())
        )
        return list(session.scalars(stmt))

    def listar_vigentes(
        self, session: Session, socio_id: int, fecha: date | None = None
    ) -> list[Sancion]:
        fecha = fecha or date.today()
        stmt = (
            select(Sancion)
            .where(Sancion.socio_id == socio_id, _vigente_en(fecha))
            .order_by(Sancion.fecha_inicio.desc())
        )
        return list(session.scalars(stmt))

    def tiene_vigentes(
        self,
        session: Session,
        socio_id: int,
        fecha: date | None = None,
        tipo: TipoSancion | None = None,
    ) -> bool:
        """Para "no prestar a socios inhabilitados". EXISTS, no carga las filas.
        Con `tipo=SUSPENSION` mira solo las suspensiones."""
        filtros = [Sancion.socio_id == socio_id, _vigente_en(fecha or date.today())]
        if tipo is not None:
            filtros.append(Sancion.tipo == tipo)
        return self.exists(session, *filtros)

    def existe_para_prestamo(self, session: Session, prestamo_id: int) -> bool:
        """Para no sancionar dos veces el mismo atraso."""
        return self.exists(session, Sancion.prestamo_id == prestamo_id)

    # ---------------------------------------------------------------- reportes

    def multas_acumuladas_por_socio(
        self, session: Session, desde: date | None = None, hasta: date | None = None
    ) -> list[Row[tuple[int, str, str, int, float]]]:
        """Reporte "multas acumuladas".
        Filas (socio_id, apellido, nombre, cantidad_multas, monto_total)."""
        total = func.coalesce(func.sum(Sancion.monto), 0).label("monto_total")
        stmt = (
            select(
                Socio.id,
                Socio.apellido,
                Socio.nombre,
                func.count(Sancion.id).label("cantidad"),
                total,
            )
            .join(Sancion, Sancion.socio_id == Socio.id)
            .where(Sancion.tipo == TipoSancion.MULTA)
            .group_by(Socio.id, Socio.apellido, Socio.nombre)
            .order_by(total.desc())
        )
        if desde is not None:
            stmt = stmt.where(Sancion.fecha_inicio >= desde)
        if hasta is not None:
            stmt = stmt.where(Sancion.fecha_inicio <= hasta)
        return list(session.execute(stmt).all())

    def total_multas(self, session: Session) -> float:
        stmt = select(func.coalesce(func.sum(Sancion.monto), 0)).where(
            Sancion.tipo == TipoSancion.MULTA
        )
        return float(session.scalar(stmt) or 0)
