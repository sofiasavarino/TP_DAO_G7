from collections.abc import Sequence
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.enums import EstadoReserva
from app.models.reserva import Reserva
from app.repositories.base_repository import BaseRepository

# Reservas que siguen "vivas" (todavia pueden terminar en prestamo).
ESTADOS_VIGENTES = (
    EstadoReserva.PENDIENTE,
    EstadoReserva.EN_CAMINO,
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
        self, session: Session, estado: EstadoReserva, sede_retiro_id: int | None = None
    ) -> list[Reserva]:
        stmt = select(Reserva).where(Reserva.estado == estado)
        if sede_retiro_id is not None:
            stmt = stmt.where(Reserva.sede_retiro_id == sede_retiro_id)
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
        """La siguiente reserva a la que hay que asignarle un ejemplar."""
        stmt = (
            select(Reserva)
            .where(Reserva.libro_id == libro_id, Reserva.estado == EstadoReserva.PENDIENTE)
            .order_by(*_orden_fifo())
            .limit(1)
        )
        return session.scalars(stmt).first()

    def get_vigente_de_ejemplar(self, session: Session, ejemplar_id: int) -> Reserva | None:
        """La reserva que tiene asignado este ejemplar (EN_CAMINO o LISTA_PARA_RETIRO).
        La usa el service al recibir un remito para saber si el ejemplar tiene dueño."""
        stmt = select(Reserva).where(
            Reserva.ejemplar_id == ejemplar_id,
            Reserva.estado.in_((EstadoReserva.EN_CAMINO, EstadoReserva.LISTA_PARA_RETIRO)),
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
