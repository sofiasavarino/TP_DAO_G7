from collections.abc import Sequence
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.enums import EstadoReserva
from app.models.reserva import Reserva
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
        self, session: Session, estado: EstadoReserva, sede_retiro_id: int | None = None, libro_id: int | None = None
    ) -> list[Reserva]:
        """Reservas en el estado dado, FIFO. Filtros opcionales que combinan con AND."""
        stmt = select(Reserva).where(Reserva.estado == estado)
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
        """Cola de espera del titulo (PENDIENTE), en orden FIFO."""
        stmt = (
            select(Reserva)
            .where(Reserva.libro_id == libro_id, Reserva.estado == EstadoReserva.PENDIENTE)
            .order_by(*_orden_fifo())
        )
        return list(session.scalars(stmt))

    def primera_en_cola(self, session: Session, libro_id: int) -> Reserva | None:
        """Primera reserva PENDIENTE para ese libro (toda la red, FIFO)."""
        return self.primera_por_estado(session, libro_id, (EstadoReserva.PENDIENTE,))

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
        """Reservas esperando `libro_id` (PENDIENTE), en toda la red.

        Se usan para descontar candidatos de la ETA: cada reserva que ya está en la
        fila consumirá el candidato más cercano antes que el socio que está mirando.
        """
        stmt = select(func.count(Reserva.id)).where(
            Reserva.libro_id == libro_id,
            Reserva.estado == EstadoReserva.PENDIENTE,
        )
        return session.scalar(stmt) or 0
