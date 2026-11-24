from collections.abc import Sequence
from datetime import date

from sqlalchemy import Row, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.ejemplar import Ejemplar
from app.models.enums import EstadoEjemplar, EstadoReserva
from app.models.libro import Libro
from app.models.reserva import Reserva
from app.models.sede import Sede
from app.repositories.base_repository import BaseRepository

# Reservas que siguen "vivas" (todavia pueden terminar en prestamo).
ESTADOS_VIGENTES = (
    EstadoReserva.PENDIENTE,
    EstadoReserva.EN_TRANSITO,
    EstadoReserva.LISTA_PARA_RETIRO,
)


def _orden_fifo():
    # FIFO estricto: gana la reserva mas vieja; a igual fecha, la de menor id.
    return (Reserva.fecha_reserva, Reserva.id)


class ReservaRepository(BaseRepository[Reserva]):
    model = Reserva

    def get_con_detalle(self, session: Session, reserva_id: int) -> Reserva | None:
        return self.get_by_id(
            session,
            reserva_id,
            selectinload(Reserva.libro),
            selectinload(Reserva.socio),
            selectinload(Reserva.sede_retiro),
            selectinload(Reserva.ejemplar),
        )

    def listar_por_socio(
        self,
        session: Session,
        socio_id: int,
        estados: Sequence[EstadoReserva] | None = None,
    ) -> list[Reserva]:
        """"Mis reservas" con libro y sede de retiro precargados."""
        stmt = select(Reserva).where(Reserva.socio_id == socio_id)
        if estados:
            stmt = stmt.where(Reserva.estado.in_(estados))
        stmt = stmt.options(
            selectinload(Reserva.libro), selectinload(Reserva.sede_retiro)
        ).order_by(Reserva.fecha_reserva.desc(), Reserva.id.desc())
        return list(session.scalars(stmt))

    def listar_por_estado(
        self,
        session: Session,
        estado: EstadoReserva,
        sede_retiro_id: int | None = None,
        libro_id: int | None = None,
        solo_sin_ejemplar: bool = False,
    ) -> list[Reserva]:
        """Reservas en el estado dado, FIFO. Filtros opcionales que combinan con AND.

        `solo_sin_ejemplar` deja afuera las que ya tienen ejemplar asignado: una PENDIENTE con
        ejemplar solo espera que se despache su remito, no está esperando un ejemplar.
        """
        stmt = select(Reserva).where(Reserva.estado == estado)
        if solo_sin_ejemplar:
            stmt = stmt.where(Reserva.ejemplar_id.is_(None))
        if sede_retiro_id is not None:
            stmt = stmt.where(Reserva.sede_retiro_id == sede_retiro_id)
        if libro_id is not None:
            stmt = stmt.where(Reserva.libro_id == libro_id)
        stmt = stmt.options(
            selectinload(Reserva.libro),
            selectinload(Reserva.socio),
            selectinload(Reserva.sede_retiro),
        ).order_by(*_orden_fifo())
        return list(session.scalars(stmt))

    def cola_pendiente_de_libro(self, session: Session, libro_id: int) -> list[Reserva]:
        """Cola de espera del titulo (PENDIENTE y sin ejemplar asignado), en orden FIFO."""
        stmt = (
            select(Reserva)
            .where(
                Reserva.libro_id == libro_id,
                Reserva.estado == EstadoReserva.PENDIENTE,
                Reserva.ejemplar_id.is_(None),
            )
            .order_by(*_orden_fifo())
        )
        return list(session.scalars(stmt))

    def primera_en_cola(self, session: Session, libro_id: int) -> Reserva | None:
        """Primera reserva PENDIENTE sin ejemplar asignado para ese libro (toda la red, FIFO)."""
        stmt = (
            select(Reserva)
            .where(
                Reserva.libro_id == libro_id,
                Reserva.estado == EstadoReserva.PENDIENTE,
                Reserva.ejemplar_id.is_(None),
            )
            .order_by(*_orden_fifo())
            .limit(1)
        )
        return session.scalars(stmt).first()

    def primera_por_estado(
        self, session: Session, libro_id: int, estados: tuple[EstadoReserva, ...]
    ) -> Reserva | None:
        """Primera reserva para `libro_id` que coincida en alguno de `estados`, FIFO."""
        stmt = (
            select(Reserva)
            .where(Reserva.libro_id == libro_id, Reserva.estado.in_(estados))
            .order_by(*_orden_fifo())
            .limit(1)
        )
        return session.scalars(stmt).first()

    def primera_en_sede(self, session: Session, libro_id: int, sede_retiro_id: int) -> Reserva | None:
        """Primera reserva pendiente o en tránsito para `libro_id` cuyo retiro es en `sede_retiro_id` (FIFO).

        Se consideran ambas estados desde que un ejemplar puede estar disponible o viajando
        (algunos ejemplares vendrán asignados internamente antes de que el remito arribe).
        Asigna al más viejo del par por fecha_reserva + id.
        """
        stmt = (
            select(Reserva)
            .where(
                Reserva.libro_id == libro_id,
                Reserva.sede_retiro_id == sede_retiro_id,
                Reserva.estado.in_((EstadoReserva.PENDIENTE, EstadoReserva.EN_TRANSITO)),
            )
            .order_by(*_orden_fifo())
            .limit(1)
        )
        return session.scalars(stmt).first()

    def get_vigente_de_ejemplar(self, session: Session, ejemplar_id: int) -> Reserva | None:
        """La reserva que tiene asignado este ejemplar (EN_TRANSITO o LISTA_PARA_RETIRO).

    Se usa al recibir un remito para saber si el ejemplar tiene dueño.
    """
        stmt = select(Reserva).where(
            Reserva.ejemplar_id == ejemplar_id,
            Reserva.estado.in_((EstadoReserva.EN_TRANSITO, EstadoReserva.LISTA_PARA_RETIRO)),
        )
        return session.scalars(stmt).first()

    def existe_vigente(self, session: Session, socio_id: int, libro_id: int) -> bool:
        """Evita que el mismo socio reserve dos veces el mismo libro."""
        return self.exists(
            session,
            Reserva.socio_id == socio_id,
            Reserva.libro_id == libro_id,
            Reserva.estado.in_(ESTADOS_VIGENTES),
        )

    def contar_vigentes_socio(self, session: Session, socio_id: int) -> int:
        return self.count(
            session, Reserva.socio_id == socio_id, Reserva.estado.in_(ESTADOS_VIGENTES)
        )

    def listar_retiro_vencido(self, session: Session, fecha: date | None = None) -> list[Reserva]:
        """LISTA_PARA_RETIRO cuya ventana de retiro ya paso (para procesar_vencimientos)."""
        stmt = (
            select(Reserva)
            .where(
                Reserva.estado == EstadoReserva.LISTA_PARA_RETIRO,
                Reserva.fecha_vencimiento_retiro < (fecha or date.today()),
            )
            .order_by(*_orden_fifo())
        )
        return list(session.scalars(stmt))

    def contar_en_cola(self, session: Session, libro_id: int) -> int:
        """Reservas esperando `libro_id` (PENDIENTE y sin ejemplar asignado), en toda la red.

        Se usan para descontar candidatos de la ETA: cada reserva que ya está en la
        fila consumirá el candidato más cercano antes que el socio que está mirando.
        """
        stmt = select(func.count(Reserva.id)).where(
            Reserva.libro_id == libro_id,
            Reserva.estado == EstadoReserva.PENDIENTE,
            Reserva.ejemplar_id.is_(None),
        )
        return session.scalar(stmt) or 0

    def get_pendiente_con_ejemplar(self, session: Session, ejemplar_id: int) -> Reserva | None:
        """Reserva PENDIENTE que ya tiene este ejemplar asignado (todavía sin despachar)."""
        stmt = select(Reserva).where(
            Reserva.ejemplar_id == ejemplar_id,
            Reserva.estado == EstadoReserva.PENDIENTE,
        )
        return session.scalars(stmt).first()

    # ---------------------------------------------------------------- reportes

    def conteo_por_estado(
        self, session: Session, desde: date | None = None, hasta: date | None = None
    ) -> dict[EstadoReserva, int]:
        """Base del reporte de cumplimiento de retiro y presupuesto de reservas."""
        stmt = select(Reserva.estado, func.count(Reserva.id)).group_by(Reserva.estado)
        if desde is not None:
            stmt = stmt.where(Reserva.fecha_reserva >= desde)
        if hasta is not None:
            stmt = stmt.where(Reserva.fecha_reserva <= hasta)
        return {estado: cantidad for estado, cantidad in session.execute(stmt)}

    def presion_por_libro(self, session: Session, limite: int = 10) -> list[Row]:
        """Libros con más reservas en cola vs. ejemplares en circulación.

        Filas (libro_id, libro, reservas_esperando, ejemplares). Sirve para decidir
        altas de copias o rebalanceos: ratio = reservas / ejemplares.
        """
        ejemplares = (
            select(func.count(Ejemplar.id))
            .where(
                Ejemplar.libro_id == Libro.id,
                Ejemplar.estado != EstadoEjemplar.INUTILIZABLE,
            )
            .correlate(Libro)
            .scalar_subquery()
        )
        stmt = (
            select(
                Libro.id.label("libro_id"),
                Libro.nombre.label("libro"),
                func.count(Reserva.id).label("reservas_esperando"),
                ejemplares.label("ejemplares"),
            )
            .join(Libro, Reserva.libro_id == Libro.id)
            .where(Reserva.estado.in_((EstadoReserva.PENDIENTE, EstadoReserva.EN_TRANSITO)))
            .group_by(Libro.id, Libro.nombre)
            .order_by(func.count(Reserva.id).desc())
            .limit(limite)
        )
        return list(session.execute(stmt).all())

    def dias_promedio_espera_por_sede(
        self, session: Session, desde: date | None = None, hasta: date | None = None
    ) -> list[Row]:
        """Días promedio desde `fecha_reserva` hasta `fecha_asignacion`, por sede de retiro.

        Sólo cuenta reservas que efectivamente fueron asignadas. Usa `julianday()`
        (SQLite), igual que el reporte de tránsito de remitos.
        """
        stmt = (
            select(
                Sede.id.label("sede_id"),
                Sede.nombre.label("sede_nombre"),
                func.count(Reserva.id).label("reservas"),
                func.avg(
                    func.julianday(Reserva.fecha_asignacion) - func.julianday(Reserva.fecha_reserva)
                ).label("dias_promedio"),
            )
            .join(Sede, Reserva.sede_retiro_id == Sede.id)
            .where(Reserva.fecha_asignacion.is_not(None))
            .group_by(Sede.id, Sede.nombre)
            .order_by(Sede.nombre)
        )
        if desde is not None:
            stmt = stmt.where(Reserva.fecha_reserva >= desde)
        if hasta is not None:
            stmt = stmt.where(Reserva.fecha_reserva <= hasta)
        return list(session.execute(stmt).all())
