from collections.abc import Sequence
from datetime import date

from sqlalchemy import Row, func, select
from sqlalchemy.orm import Session, aliased, selectinload

from app.models.ejemplar import Ejemplar
from app.models.enums import EstadoRemito, MotivoTraslado
from app.models.remito import Remito, remito_ejemplar
from app.models.sede import Sede
from app.repositories.base_repository import BaseRepository


def _detalle():
    """Todo lo que muestra la pantalla de un remito, en pocas queries."""
    return (
        selectinload(Remito.ejemplares).selectinload(Ejemplar.libro),
        selectinload(Remito.sede_origen),
        selectinload(Remito.sede_destino),
        selectinload(Remito.responsable_creacion),
        selectinload(Remito.responsable_despacho),
        selectinload(Remito.responsable_recepcion),
    )


class RemitoRepository(BaseRepository[Remito]):
    model = Remito

    def get_by_numero(self, session: Session, numero_remito: str) -> Remito | None:
        stmt = select(Remito).where(Remito.numero_remito == numero_remito)
        return session.scalars(stmt).first()

    def existe_numero(self, session: Session, numero_remito: str) -> bool:
        return self.exists(session, Remito.numero_remito == numero_remito)

    def get_con_ejemplares(self, session: Session, remito_id: int) -> Remito | None:
        """Remito con ejemplares (y su libro), sedes y responsables. Sin N+1."""
        return self.get_by_id(session, remito_id, *_detalle())

    def listar(
        self,
        session: Session,
        estados: Sequence[EstadoRemito] | None = None,
        sede_origen_id: int | None = None,
        sede_destino_id: int | None = None,
    ) -> list[Remito]:
        """Listado general con filtros. Ejemplos de uso desde el service:
        - pendientes de despacho:   estados=[CREADO],         sede_origen_id=mi_sede
        - pendientes de recepcion:  estados=[EN_TRANSITO],    sede_destino_id=mi_sede
        - con incidencia:           estados=[CON_INCIDENCIA]
        """
        stmt = select(Remito)
        if estados:
            stmt = stmt.where(Remito.estado.in_(estados))
        if sede_origen_id is not None:
            stmt = stmt.where(Remito.sede_origen_id == sede_origen_id)
        if sede_destino_id is not None:
            stmt = stmt.where(Remito.sede_destino_id == sede_destino_id)
        stmt = stmt.options(*_detalle()).order_by(Remito.fecha_creacion.desc(), Remito.id.desc())
        return list(session.scalars(stmt))

    def pendientes_de_despacho(self, session: Session, sede_origen_id: int | None = None) -> list[Remito]:
        return self.listar(session, [EstadoRemito.CREADO], sede_origen_id=sede_origen_id)

    def pendientes_de_recepcion(self, session: Session, sede_destino_id: int | None = None) -> list[Remito]:
        return self.listar(session, [EstadoRemito.EN_TRANSITO], sede_destino_id=sede_destino_id)

    def historial_de_ejemplar(self, session: Session, ejemplar_id: int) -> list[Remito]:
        """Trazabilidad: todos los remitos por los que paso un ejemplar, del mas viejo al mas nuevo."""
        stmt = (
            select(Remito)
            .join(remito_ejemplar, remito_ejemplar.c.remito_id == Remito.id)
            .where(remito_ejemplar.c.ejemplar_id == ejemplar_id)
            .options(selectinload(Remito.sede_origen), selectinload(Remito.sede_destino))
            .order_by(Remito.fecha_creacion, Remito.id)
        )
        return list(session.scalars(stmt))

    def get_en_transito_de_ejemplar(self, session: Session, ejemplar_id: int) -> Remito | None:
        """El remito que esta llevando al ejemplar ahora mismo (si hay uno)."""
        stmt = (
            select(Remito)
            .join(remito_ejemplar, remito_ejemplar.c.remito_id == Remito.id)
            .where(
                remito_ejemplar.c.ejemplar_id == ejemplar_id,
                Remito.estado.in_((EstadoRemito.CREADO, EstadoRemito.EN_TRANSITO)),
            )
        )
        return session.scalars(stmt).first()

    def fue_servida_por_remito(
        self, session: Session, ejemplar_id: int, sede_destino_id: int, desde: date
    ) -> bool:
        """¿Un remito IDA recibido desde `desde` trajo el ejemplar a esa sede?

        Se usa para clasificar el préstamo que nace de una reserva. Sólo cuenta el
        viaje que pudo habilitar esa reserva: un remito anterior (p. ej. un
        REBALANCEO o un traslado de otro préstamo) no convierte en interbibliotecario
        un retiro que se sirvió con un ejemplar ya presente en la sede.
        """
        stmt = (
            select(Remito.id)
            .join(remito_ejemplar, remito_ejemplar.c.remito_id == Remito.id)
            .where(
                remito_ejemplar.c.ejemplar_id == ejemplar_id,
                Remito.sede_destino_id == sede_destino_id,
                Remito.sede_origen_id != sede_destino_id,
                Remito.motivo_traslado == MotivoTraslado.IDA,
                Remito.estado.in_((EstadoRemito.RECIBIDO, EstadoRemito.CON_INCIDENCIA)),
                Remito.fecha_recepcion >= desde,
            )
            .limit(1)
        )
        return session.scalars(stmt).first() is not None

    # ---------------------------------------------------------------- reportes

    def conteo_por_estado(
        self, session: Session, desde: date | None = None, hasta: date | None = None
    ) -> dict[EstadoRemito, int]:
        """Base del reporte "tasa de envios exitosos e incidencias".
        El service calcula la tasa: RECIBIDO / (RECIBIDO + CON_INCIDENCIA)."""
        stmt = select(Remito.estado, func.count(Remito.id)).group_by(Remito.estado)
        if desde is not None:
            stmt = stmt.where(Remito.fecha_creacion >= desde)
        if hasta is not None:
            stmt = stmt.where(Remito.fecha_creacion <= hasta)
        return {estado: cantidad for estado, cantidad in session.execute(stmt)}

    def en_transito_por_sede(self, session: Session) -> list[Row]:
        """Material viajando hacia cada sede: remitos EN_TRANSITO y sus ejemplares."""
        cantidad = (
            select(
                remito_ejemplar.c.remito_id,
                func.count(remito_ejemplar.c.ejemplar_id).label("cant"),
            )
            .group_by(remito_ejemplar.c.remito_id)
            .subquery()
        )
        stmt = (
            select(
                Sede.id.label("sede_id"),
                Sede.nombre.label("sede"),
                func.count(Remito.id).label("remitos"),
                func.coalesce(func.sum(cantidad.c.cant), 0).label("ejemplares"),
            )
            .join(Sede, Remito.sede_destino_id == Sede.id)
            .outerjoin(cantidad, cantidad.c.remito_id == Remito.id)
            .where(Remito.estado == EstadoRemito.EN_TRANSITO)
            .group_by(Sede.id, Sede.nombre)
            .order_by(Sede.nombre)
        )
        return list(session.execute(stmt).all())

    def movimientos_entre_sedes(
        self, session: Session, desde: date | None = None, hasta: date | None = None
    ) -> list[Row[tuple[str, str, int, int, float | None]]]:
        """Reporte "movimiento de ejemplares entre sedes".
        Filas (origen, destino, cantidad_remitos, cantidad_ejemplares, dias_promedio_transito).

        El promedio de transito usa `julianday()`, que es una funcion de SQLite
        (la base del proyecto): resta las fechas en dias. Solo cuenta remitos ya recibidos.
        """
        origen = aliased(Sede)
        destino = aliased(Sede)

        # Cantidad de ejemplares por remito, como subconsulta para no duplicar filas.
        ejemplares_por_remito = (
            select(
                remito_ejemplar.c.remito_id,
                func.count(remito_ejemplar.c.ejemplar_id).label("cant"),
            )
            .group_by(remito_ejemplar.c.remito_id)
            .subquery()
        )
        dias_transito = func.julianday(Remito.fecha_recepcion) - func.julianday(Remito.fecha_despacho)

        stmt = (
            select(
                origen.nombre.label("origen"),
                destino.nombre.label("destino"),
                func.count(Remito.id).label("remitos"),
                func.coalesce(func.sum(ejemplares_por_remito.c.cant), 0).label("ejemplares"),
                func.avg(dias_transito).label("dias_promedio"),
            )
            .join(origen, Remito.sede_origen_id == origen.id)
            .join(destino, Remito.sede_destino_id == destino.id)
            .outerjoin(ejemplares_por_remito, ejemplares_por_remito.c.remito_id == Remito.id)
            .group_by(origen.nombre, destino.nombre)
            .order_by(func.count(Remito.id).desc())
        )
        if desde is not None:
            stmt = stmt.where(Remito.fecha_creacion >= desde)
        if hasta is not None:
            stmt = stmt.where(Remito.fecha_creacion <= hasta)
        return list(session.execute(stmt).all())
