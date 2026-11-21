from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.dtos.prestamo_dto import PrestamoCreate, PrestamoListadoDTO
from app.exceptions import (
    BibliotecaError,
    EjemplarNoDisponible,
    LimitePrestamosExcedido,
    SocioSancionado,
)
from app.models.enums import EstadoEjemplar, EstadoPrestamo, TipoPrestamo, TipoSancion
from app.models.prestamo import Prestamo
from app.models.sancion import Sancion
from app.repositories.ejemplar_repository import EjemplarRepository
from app.repositories.prestamo_repository import PrestamoRepository
from app.repositories.reserva_repository import ReservaRepository
from app.repositories.sancion_repository import SancionRepository
from app.repositories.socio_repository import SocioRepository
from app.services.reserva_service import asignar_ejemplar_a_reserva_mas_vieja
from app.notifications import mensajes
from app.utils.fechas import dias_habiles_entre

DIAS_PRESTAMO = 15
MAX_PRESTAMOS_ABIERTOS = 2
MULTA_BASE = 5000.0
MULTA_INTERES_DIARIO = 0.02  # 2% diario compuesto (mismo en el front)

prestamo_repo = PrestamoRepository()
ejemplar_repo = EjemplarRepository()
socio_repo = SocioRepository()
sancion_repo = SancionRepository()
reserva_repo = ReservaRepository()


def _to_listado(p: Prestamo) -> PrestamoListadoDTO:
    return PrestamoListadoDTO(
        id=p.id,
        numero=p.numero,
        estado=p.estado,
        tipo=p.tipo,
        fecha_vencimiento=p.fecha_vencimiento,
        socio_id=p.socio_id,
        socio_nombre=f"{p.socio.nombre} {p.socio.apellido}",
        ejemplar_id=p.ejemplar_id,
        ejemplar_codigo=p.ejemplar.codigo_inventario,
    )


def listar_todos(session: Session) -> list[PrestamoListadoDTO]:
    return [_to_listado(p) for p in prestamo_repo.listar(session)]


def listar_mios(session: Session, socio_id: int) -> list[PrestamoListadoDTO]:
    return [_to_listado(p) for p in prestamo_repo.listar_por_socio(session, socio_id)]


def listar_vencidos(session: Session) -> list[PrestamoListadoDTO]:
    return [_to_listado(p) for p in prestamo_repo.listar(session, estados=[EstadoPrestamo.VENCIDO])]


def _validar_socio_y_limite(session: Session, socio_id: int):
    """Socio existe, sin sanción vigente y sin alcanzar el cupo de préstamos abiertos."""
    socio = socio_repo.get_by_id(session, socio_id, incluir_inactivos=True)
    if socio is None:
        raise ValueError(f"socio {socio_id} no existe")

    if sancion_repo.tiene_vigentes(session, socio_id):
        raise SocioSancionado(
            f"socio {socio_id} tiene sanción vigente; no puede retirar libros"
        )

    if prestamo_repo.contar_abiertos_socio(session, socio_id) >= MAX_PRESTAMOS_ABIERTOS:
        raise LimitePrestamosExcedido(
            f"socio {socio_id} alcanza el límite de {MAX_PRESTAMOS_ABIERTOS} préstamos activos"
        )
    return socio


def _nuevo_prestamo(
    session: Session,
    socio_id: int,
    ejemplar_id: int,
    tipo: TipoPrestamo,
    observaciones: str | None,
) -> Prestamo:
    numero = int(session.scalar(select(func.count(Prestamo.id))) or 0) + 1
    ahora = date.today()
    prestamo = Prestamo(
        numero=f"P-{numero:06d}",
        tipo=tipo,
        estado=EstadoPrestamo.ACTIVO,
        fecha_inicio=ahora,
        fecha_vencimiento=ahora + timedelta(days=DIAS_PRESTAMO),
        observaciones=observaciones,
        socio_id=socio_id,
        ejemplar_id=ejemplar_id,
    )
    prestamo_repo.add(session, prestamo)
    session.flush()
    session.refresh(prestamo)
    return prestamo


def crear_prestamo(session: Session, datos: PrestamoCreate) -> Prestamo:
    _validar_socio_y_limite(session, datos.socio_id)

    ejemplar = ejemplar_repo.get_by_id(session, datos.ejemplar_id, incluir_inactivos=True)
    if ejemplar is None:
        raise ValueError(f"ejemplar {datos.ejemplar_id} no existe")
    if ejemplar.estado != EstadoEjemplar.DISPONIBLE:
        raise EjemplarNoDisponible(
            f"ejemplar {ejemplar.codigo_inventario} no disponible (estado: {ejemplar.estado.value})"
        )

    ejemplar.estado = EstadoEjemplar.PRESTADO
    return _nuevo_prestamo(session, datos.socio_id, datos.ejemplar_id, datos.tipo, datos.observaciones)


def crear_prestamo_para_reserva(
    session: Session,
    socio_id: int,
    ejemplar_id: int,
    tipo: TipoPrestamo = TipoPrestamo.LOCAL,
    observaciones: str | None = None,
) -> Prestamo:
    """Préstamo que nace cuando el socio retira una reserva LISTA_PARA_RETIRO.

    A diferencia de `crear_prestamo`, el ejemplar viene RESERVADO para ese socio
    (no DISPONIBLE), por eso el estado aceptado cambia.
    """
    _validar_socio_y_limite(session, socio_id)

    ejemplar = ejemplar_repo.get_by_id(session, ejemplar_id, incluir_inactivos=True)
    if ejemplar is None:
        raise ValueError(f"ejemplar {ejemplar_id} no existe")
    if ejemplar.estado != EstadoEjemplar.RESERVADO:
        raise EjemplarNoDisponible(
            f"ejemplar {ejemplar.codigo_inventario} no está reservado "
            f"(estado: {ejemplar.estado.value})"
        )

    ejemplar.estado = EstadoEjemplar.PRESTADO
    return _nuevo_prestamo(session, socio_id, ejemplar_id, tipo, observaciones)


def crear_sancion_por_retraso(
    session: Session, prestamo_id: int, hoy: date | None = None
) -> Sancion | None:
    """Si hay retraso (días hábiles desde `fecha_vencimiento` hasta `hoy`), crea una
    sanción de tipo MULTA. Devuelve None si no hay retraso / ya tiene sanción.

    Multa = MULTA_BASE * (1 + MULTA_INTERES_DIARIO) ^ días_hábiles_de_retraso.
    Ejemplo frontend: $5000 * 1.02^n.1, 15 días → 6725.97
    """
    hoy = hoy or date.today()
    prestamo = prestamo_repo.get_by_id(session, prestamo_id)
    if prestamo is None:
        raise ValueError(f"préstamo {prestamo_id} no existe")

    if sancion_repo.existe_para_prestamo(session, prestamo_id):
        return None  # ya sancionado por este retraso

    dias_retraso = dias_habiles_entre(prestamo.fecha_vencimiento, hoy)
    if dias_retraso == 0:
        return None

    monto = round(MULTA_BASE * ((1 + MULTA_INTERES_DIARIO) ** dias_retraso), 2)
    sancion = Sancion(
        tipo=TipoSancion.MULTA,
        fecha_inicio=hoy,
        fecha_fin=None,
        motivo=f"Devolución tardía del préstamo {prestamo.numero} ({dias_retraso} día(s) hábiles de retraso)",
        monto=monto,
        socio_id=prestamo.socio_id,
        prestamo_id=prestamo.id,
    )
    sancion = sancion_repo.add(session, sancion)
    mensajes.avisar_sancion_aplicada(session, prestamo.socio, sancion)
    return sancion


def devolver_prestamo(session: Session, prestamo_id: int, sede_id: int, usuario_id: int) -> Prestamo:
    """Cierra el préstamo: registra devolución, aplica sanción si hay retraso.

    Busca la reserva más vieja para el libro:
      - si es en la MISMA sede donde se devolvió: asignada (RESERVADO)
      - si es en OTRA sede: reserva EN_TRANSITO, ejemplar DISPONIBLE (requiere remito)
      - si no hay ninguna: ejemplar DISPONIBLE

    FINALIZADO."""
    prestamo = prestamo_repo.get_by_id(session, prestamo_id)
    if prestamo is None:
        raise ValueError(f"préstamo {prestamo_id} no existe")
    if prestamo.estado == EstadoPrestamo.FINALIZADO:
        raise ValueError(f"préstamo {prestamo_id} ya devuelto")

    hoy = date.today()
    prestamo.fecha_devolucion = hoy
    prestamo.estado = EstadoPrestamo.FINALIZADO

    # Sancion por retraso (si aplica)
    crear_sancion_por_retraso(session, prestamo_id, hoy)

    ejemplar = prestamo.ejemplar
    ejemplar.sede_actual_id = sede_id

    asignar_ejemplar_a_reserva_mas_vieja(session, ejemplar, hoy, usuario_id=usuario_id)

    session.flush()
    session.refresh(prestamo)
    return prestamo


def renovar_prestamo(session: Session, prestamo_id: int) -> Prestamo:
    """Extiende fecha_vencimiento por DIAS_PRESTAMO días.

    Bloqueado si:
    - el préstamo no existe o no está ACTIVO
    - ya estamos pasados de la fecha de vencimiento (atraso => no renueva)
    - hay reserva esperando por ese libro (recir mantiene la etiqueta)
    """
    prestamo = prestamo_repo.get_by_id(session, prestamo_id)
    if prestamo is None:
        raise ValueError(f"préstamo {prestamo_id} no existe")
    if prestamo.estado != EstadoPrestamo.ACTIVO:
        raise BibliotecaError(
            f"Solo se renuevan préstamos ACTIVO (estado actual: {prestamo.estado.value})"
        )

    hoy = date.today()
    if hoy > prestamo.fecha_vencimiento:
        raise BibliotecaError(
            f"Préstamo vencido el {prestamo.fecha_vencimiento}; no se puede renovar"
        )

    libro_id = prestamo.ejemplar.libro_id
    if reserva_repo.primera_en_cola(session, libro_id) is not None:
        raise BibliotecaError(
            f"Hay reserva esperando por este libro; no se puede renovar"
        )

    prestamo.fecha_vencimiento = prestamo.fecha_vencimiento + timedelta(days=DIAS_PRESTAMO)
    session.flush()
    session.refresh(prestamo)
    return prestamo
