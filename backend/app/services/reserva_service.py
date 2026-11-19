"""Lógica compartida de asignación de reservas a ejemplares.

Se usa en devolución (ejemplar pasa a DISPONIBLE) y en recepción de remito
(ejemplar llega a su sede). Contiene la regla de negocio:

    asignar la reserva más vieja (FIFO global) para ese libro:
      - si está en la misma sede, se asigna al ejemplar
      - si está en otra sede, la reserva queda EN_TRANSITO (necesita un remito)
      - si no hay reserva, el ejemplar queda DISPONIBLE
"""

from datetime import date

from sqlalchemy.orm import Session

from app.models.enums import EstadoEjemplar, EstadoReserva

from app.models.ejemplar import Ejemplar
from app.models.reserva import Reserva
from app.repositories.ejemplar_repository import EjemplarRepository
from app.repositories.reserva_repository import ReservaRepository
from app.repositories.remito_repository import RemitoRepository
from app.utils.fechas import sumar_dias_habiles

ejemplar_repo = EjemplarRepository()
reserva_repo = ReservaRepository()
remito_repo = RemitoRepository()


def asignar_ejemplar_a_reserva_mas_vieja(
    session: Session, ejemplar: Ejemplar, hoy: date | None = None, usuario_id: int | None = None
) -> None:
    """Asigna la reserva más vieja para el libro del ejemplar, respetando sede.

    Considera reservas en estado PENDIENTE o EN_TRANSITO (reservas esperando un ejemplar).
    - reserva global se obtiene FIFO por (fecha_reserva, id).
    - si la reserva es en la misma sede, se asigna: LISTA_PARA_RETIRO + ejemplar RESERVADO.
      Si había otro ejemplar asignado a esa reserva, sale moviéndose a su siguiente estado
      (EN_TRANSITO si viaja, DISPONIBLE si en sucursal).
    - si la reserva está en otra sede, se encola el ejemplar en el remito CREADO más
      antiguo de esa ruta (o se crea uno si no hay) — la reserva queda EN_TRANSITO.
    - si no hay reserva en el sistema para este libro, el ejemplar queda DISPONIBLE.
    """
    hoy = hoy or date.today()
    # Cuando nos llaman, el ejemplar acaba de devolver: lo ponemos a DISPONIBLE
    # y cada rama puede volver a RESERVADO si corresponde.
    ejemplar.estado = EstadoEjemplar.DISPONIBLE
    reserva = reserva_repo.primera_por_estado(
        session, ejemplar.libro_id, (EstadoReserva.PENDIENTE, EstadoReserva.EN_TRANSITO)
    )

    # Branch B: ninguna reserva espera ese libro en absoluto
    if reserva is None:
        return

    # Branch A: la reserva más vieja está en otra sede → encolar en remito (o crear uno)
    if reserva.sede_retiro_id != ejemplar.sede_actual_id:
        if usuario_id is None:
            raise ValueError("usuario_id requerido para encolumnar en remito interbibliotecario")
        # import diferido: remito_service importa de este módulo (asignar_ejemplar_a_reserva_mas_vieja)
        from app.services.remito_service import encolar_ejemplar_en_ruta

        encolar_ejemplar_en_ruta(
            session, ejemplar, sede_destino_id=reserva.sede_retiro_id, usuario_id=usuario_id
        )
        reserva.estado = EstadoReserva.EN_TRANSITO
        reserva.ejemplar_id = ejemplar.id
        ejemplar.estado = EstadoEjemplar.RESERVADO
        return

    # Branch A2: misma sede — asignar
    if reserva.ejemplar_id is not None and reserva.ejemplar_id != ejemplar.id:
        viejo = ejemplar_repo.get_by_id(
            session, reserva.ejemplar_id, incluir_inactivos=True
        )
        if viejo is not None:
            viejo.estado = (
                EstadoEjemplar.EN_TRANSITO
                if remito_repo.get_en_transito_de_ejemplar(session, viejo.id) is not None
                else EstadoEjemplar.DISPONIBLE
            )

    reserva.ejemplar_id = ejemplar.id
    reserva.estado = EstadoReserva.LISTA_PARA_RETIRO
    reserva.fecha_asignacion = hoy
    reserva.fecha_vencimiento_retiro = sumar_dias_habiles(hoy, 2)
    ejemplar.estado = EstadoEjemplar.RESERVADO
