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

from app.models.enums import EstadoEjemplar, EstadoReserva, EstadoSocio, TipoPrestamo

from app.dtos.reserva_dto import ReservaCreate, ReservaDTO, ReservaEtaDTO
from app.exceptions import LibroNoEncontrado, ReservaNoEncontrada, SocioSancionado
from app.models.ejemplar import Ejemplar
from app.models.prestamo import Prestamo
from app.models.reserva import Reserva
from app.repositories.ejemplar_repository import EjemplarRepository
from app.repositories.libro_repository import LibroRepository
from app.repositories.prestamo_repository import PrestamoRepository
from app.repositories.reserva_repository import ReservaRepository
from app.repositories.remito_repository import RemitoRepository
from app.repositories.sancion_repository import SancionRepository
from app.repositories.sede_repository import SedeRepository
from app.repositories.socio_repository import SocioRepository
from app.utils.fechas import sumar_dias_habiles

ejemplar_repo = EjemplarRepository()
libro_repo = LibroRepository()
prestamo_repo = PrestamoRepository()
reserva_repo = ReservaRepository()
remito_repo = RemitoRepository()
sancion_repo = SancionRepository()
sede_repo = SedeRepository()
socio_repo = SocioRepository()

# Días hábiles estimados para que un ejemplar viaje entre sedes.
DIAS_TRANSITO = 3
# Días hábiles de retraso medio que un socio suele tardar en devolver un libro.
DIAS_RETRASO_PROMEDIO = 2


# ------------------------------------------------------------------ reserva vista previa ETA


def calcular_eta(session: Session, libro_id: int, sede_retiro_id: int) -> date | None:
    """Fecha mínima estimada en que un ejemplar del libro se podrá retirar en `sede_retiro_id`.

    Sin escrituras. Heurística simple por ejemplar:
    - DISPONIBLE acá                  → hoy
    - DISPONIBLE en otra sede         → hoy + DIAS_TRANSITO hábiles
    - PRESTADO con préstamo abierto   → fecha_vencimiento + DIAS_RETRASO_PROMEDIO
      (retraso medio de devolución) y, si está en otra sede, + DIAS_TRANSITO más
    - El resto (RESERVADO, EN_TRANSITO, EN_REPARACION, INUTILIZABLE) → no estimable, se salta.

    Candidatos ordenados por fecha ascendente. Las reservas PENDIENTE del libro que ya
    están en la fila consumirán los primeros candidatos (una cada uno, en orden FIFO),
    así que quien pregunta ve el (N+1)-ésimo: N = cantidad de reservas esperando ese libro.

    Devuelve None si no alcanzan los candidatos para la cantidad de reservas en fila.
    """
    hoy = date.today()
    candidatos: list[date] = []
    for ejemplar in ejemplar_repo.listar_por_libro(session, libro_id):
        if ejemplar.estado == EstadoEjemplar.DISPONIBLE:
            candidatos.append(
                hoy
                if ejemplar.sede_actual_id == sede_retiro_id
                else sumar_dias_habiles(hoy, DIAS_TRANSITO)
            )
        elif ejemplar.estado == EstadoEjemplar.PRESTADO:
            prestamo = prestamo_repo.get_abierto_de_ejemplar(session, ejemplar.id)
            if prestamo is not None:
                # + retraso medio de devolución; + tránsito si llega de otra sede
                base = sumar_dias_habiles(prestamo.fecha_vencimiento, DIAS_RETRASO_PROMEDIO)
                candidatos.append(
                    base
                    if ejemplar.sede_actual_id == sede_retiro_id
                    else sumar_dias_habiles(base, DIAS_TRANSITO)
                )
    candidatos.sort()
    esperando = reserva_repo.contar_en_cola(session, libro_id)
    if esperando < len(candidatos):
        return candidatos[esperando]
    return None


def eta_para_reserva(session: Session, libro_id: int, sede_retiro_id: int) -> ReservaEtaDTO:
    """Vista previa para el socio antes de reservar (no crea nada)."""
    eta = calcular_eta(session, libro_id, sede_retiro_id)
    return ReservaEtaDTO(
        libro_id=libro_id,
        sede_retiro_id=sede_retiro_id,
        disponible_ahora=eta == date.today(),
        eta=eta,
    )


# ------------------------------------------------------------------ alta de reserva


def crear_reserva(session: Session, datos: ReservaCreate, usuario_id: int) -> Reserva:
    """Alta de una reserva con sede de retiro concreta.

    - Ejemplar DISPONIBLE en la sede de retiro → asignado: RESERVADO + LISTA_PARA_RETIRO
      (`fecha_asignacion=hoy`, ventana de retiro de 2 días hábiles).
    - Sin ejemplar local pero DISPONIBLE en otra sede → se encola (o crea) un remito IDA
      con responsable = quien crea la reserva; el ejemplar queda RESERVADO y la reserva
      EN_TRANSITO hasta que el remito arribe.
    - Sin ejemplar disponible en ninguna sede → queda PENDIENTE.

    Valida: socio activo y sin sanción vigente; libro y sede activos.
    """
    socio = socio_repo.get_by_id(session, datos.socio_id, incluir_inactivos=True)
    if socio is None:
        raise ValueError(f"socio {datos.socio_id} no existe")
    if socio.estado != EstadoSocio.ACTIVO:
        raise ValueError(f"socio {datos.socio_id} no está activo (estado: {socio.estado.value})")
    if sancion_repo.tiene_vigentes(session, datos.socio_id):
        raise SocioSancionado(
            f"socio {datos.socio_id} tiene sanción vigente; no puede reservar libros"
        )

    if libro_repo.get_by_id(session, datos.libro_id, incluir_inactivos=True) is None:
        raise LibroNoEncontrado(f"No existe el libro {datos.libro_id}.")
    if not sede_repo.esta_activa(session, datos.sede_retiro_id):
        raise ValueError(f"La sede {datos.sede_retiro_id} no existe o está dada de baja")

    hoy = date.today()
    reserva = Reserva(
        socio_id=datos.socio_id,
        libro_id=datos.libro_id,
        sede_retiro_id=datos.sede_retiro_id,
        estado=EstadoReserva.PENDIENTE,
        fecha_reserva=hoy,
    )

    local = ejemplar_repo.primer_disponible(session, datos.libro_id, sede_id=datos.sede_retiro_id)
    if local is not None:
        local.estado = EstadoEjemplar.RESERVADO
        reserva.ejemplar_id = local.id
        reserva.estado = EstadoReserva.LISTA_PARA_RETIRO
        reserva.fecha_asignacion = hoy
        reserva.fecha_vencimiento_retiro = sumar_dias_habiles(hoy, 2)
        return reserva_repo.add(session, reserva)

    # No hay local: ¿hay DISPONIBLE en otra sede? → misma jugada que en la devolución.
    disponible_fuera = ejemplar_repo.primer_disponible(session, datos.libro_id)
    if disponible_fuera is not None:
        # import diferido: remito_service importa de este módulo (asignar_ejemplar_a_reserva_mas_vieja)
        from app.services.remito_service import encolar_ejemplar_en_ruta

        encolar_ejemplar_en_ruta(
            session, disponible_fuera, sede_destino_id=datos.sede_retiro_id, usuario_id=usuario_id
        )
        disponible_fuera.estado = EstadoEjemplar.RESERVADO
        reserva.ejemplar_id = disponible_fuera.id
        reserva.estado = EstadoReserva.EN_TRANSITO
    # Si no hay disponible en ningún lado, la reserva queda PENDIENTE.
    return reserva_repo.add(session, reserva)


def procesar_retiro(
    session: Session,
    reserva_id: int,
    sede_id: int,
    usuario_id: int,
    tipo: TipoPrestamo = TipoPrestamo.LOCAL,
) -> Prestamo:
    """Retiro de un ejemplar reservado: la reserva cierra CUMPLIDA y nace el préstamo.

    Valida, sin tocar nada si algo falla:
    - la reserva existe;
    - está LISTA_PARA_RETIRO;
    - la ventana de retiro (2 días hábiles) no venció;
    - se retira en la sede de retiro de la reserva;
    - el socio está activo/sin sanción vigente y con cupo de préstamos (lo valida el
      service de préstamos);
    - el ejemplar está efectivamente RESERVADO.
    """
    reserva = reserva_repo.get_con_detalle(session, reserva_id)
    if reserva is None:
        raise ReservaNoEncontrada(f"No existe la reserva {reserva_id}.")
    if reserva.ejemplar_id is None:
        raise ValueError(f"La reserva {reserva_id} no tiene ejemplar asignado; no se puede retirar.")
    if reserva.estado != EstadoReserva.LISTA_PARA_RETIRO:
        raise ValueError(
            f"La reserva {reserva_id} no está lista para retirar (estado: {reserva.estado.value})."
        )
    hoy = date.today()
    if reserva.fecha_vencimiento_retiro is not None and hoy > reserva.fecha_vencimiento_retiro:
        raise ValueError(
            f"La reserva {reserva_id} venció el {reserva.fecha_vencimiento_retiro}; "
            "no se puede retirar."
        )
    if sede_id != reserva.sede_retiro_id:
        raise ValueError(
            f"La reserva se retira en la sede {reserva.sede_retiro_id}; no en la sede {sede_id}."
        )

    # import diferido: prestamo_service importa de este módulo (asignar_ejemplar_a_reserva_mas_vieja)
    from app.services.prestamo_service import crear_prestamo_para_reserva

    prestamo = crear_prestamo_para_reserva(
        session,
        socio_id=reserva.socio_id,
        ejemplar_id=reserva.ejemplar_id,
        tipo=tipo,
        observaciones=f"Retiro de reserva {reserva_id} (confirmado por usuario {usuario_id})",
    )
    reserva.estado = EstadoReserva.CUMPLIDA
    return prestamo


def listar_mios(session: Session, socio_id: int) -> list[ReservaDTO]:
    """Reservas del socio, de la más reciente a la más vieja."""
    if socio_repo.get_by_id(session, socio_id, incluir_inactivos=True) is None:
        raise ValueError(f"socio {socio_id} no existe")
    return [ReservaDTO.model_validate(r) for r in reserva_repo.listar_por_socio(session, socio_id)]


def listar_pendientes(
    session: Session,
    libro_id: int | None = None,
    sede_id: int | None = None,
) -> list[ReservaDTO]:
    """Cola de espera SIN ejemplar (PENDIENTE) de toda la red, FIFO estricto.

    Pensada para el tablero de mostrador/admin: qué se está esperando y quién.
    Los filtros combinan con AND: `?libro_id=1&sede_id=2` muestra sólo las pendientes
    del libro 1 que se retiran en la sede 2.
    """
    return [
        ReservaDTO.model_validate(r)
        for r in reserva_repo.listar_por_estado(
            session, EstadoReserva.PENDIENTE, sede_retiro_id=sede_id, libro_id=libro_id
        )
    ]


def procesar_vencimientos(
    session: Session,
    hoy: date | None = None,
    usuario_id: int | None = None,
) -> list[Reserva]:
    """Expira las reservas LISTA_PARA_RETIRO cuya ventana de retiro ya pasó.

    Para cada una (orden FIFO):
    - reserva → VENCIDA;
    - si su ejemplar sigue RESERVADO para ella, se libera (DISPONIBLE) y se sirve
      la siguiente reserva más vieja FIFO del libro (LISTA_PARA_RETIRO misma sede,
      EN_TRANSITO otra sede, o queda DISPONIBLE si no hay cola);
    - si el ejemplar ya no está RESERVADO (estado inconsistente), la reserva igual
      se marca VENCIDA pero no se toca el ejemplar.

    Devuelve las reservas que quedaron VENCIDA.
    """
    hoy = hoy or date.today()
    vencidas = reserva_repo.listar_retiro_vencido(session, hoy)
    for reserva in vencidas:
        ejemplar = None
        if reserva.ejemplar_id is not None:
            ejemplar = ejemplar_repo.get_by_id(session, reserva.ejemplar_id, incluir_inactivos=True)
        reserva.estado = EstadoReserva.VENCIDA
        if ejemplar is None or ejemplar.estado != EstadoEjemplar.RESERVADO:
            continue
        # asignar_* libera el ejemplar (DISPONIBLE) y sirve la siguiente reserva más vieja FIFO del libro.
        asignar_ejemplar_a_reserva_mas_vieja(session, ejemplar, hoy, usuario_id=usuario_id)
    return vencidas


def cancelar_reserva(session: Session, reserva_id: int, usuario_id: int | None = None) -> Reserva:
    """Cancelación de reserva por cualquier vía (socio en la app, mostrador, admin).

    - Sólo cancela reservas vivas: PENDIENTE, EN_TRANSITO o LISTA_PARA_RETIRO.
      CUMPLIDA, VENCIDA o CANCELADA → error (la préstamo o la ventana ya se consumaron).
    - Si el ejemplar asignado sigue RESERVADO y NO está en un remito abierto, se libera
      y se sirve la siguiente reserva más vieja FIFO del libro.
    - Si ya está viajando en un remito abierto, la reserva igual se cancela y el
      ejemplar se reasigna al llegar al destino (lo maneja la recepción).
    """
    reserva = reserva_repo.get_con_detalle(session, reserva_id)
    if reserva is None:
        raise ReservaNoEncontrada(f"No existe la reserva {reserva_id}.")
    cancelables = (
        EstadoReserva.PENDIENTE,
        EstadoReserva.EN_TRANSITO,
        EstadoReserva.LISTA_PARA_RETIRO,
    )
    if reserva.estado == EstadoReserva.CANCELADA:
        raise ValueError(f"La reserva {reserva_id} ya está cancelada.")
    if reserva.estado not in cancelables:
        raise ValueError(
            f"No se puede cancelar la reserva {reserva_id} en estado {reserva.estado.value}."
        )

    hoy = date.today()
    ejemplar = None
    if reserva.ejemplar_id is not None:
        ejemplar = ejemplar_repo.get_by_id(session, reserva.ejemplar_id, incluir_inactivos=True)
    reserva.estado = EstadoReserva.CANCELADA

    if ejemplar is not None and ejemplar.estado == EstadoEjemplar.RESERVADO:
        if remito_repo.get_en_transito_de_ejemplar(session, ejemplar.id) is None:
            # asignar_* libera (DISPONIBLE) y sirve la siguiente reserva más vieja FIFO del libro
            asignar_ejemplar_a_reserva_mas_vieja(session, ejemplar, hoy, usuario_id=usuario_id)
        # si está en un remito abierto, al llegar al destino la recepción lo reasigna FIFO
    return reserva


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
