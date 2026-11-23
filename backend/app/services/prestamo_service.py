from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.dtos.ejemplar_dto import EjemplarCreate
from app.dtos.prestamo_dto import PrestamoCreate, PrestamoListadoDTO
from app.exceptions import (
    BibliotecaError,
    LimitePrestamosExcedido,
    SocioSancionado,
)
from app.models.enums import EstadoEjemplar, EstadoPrestamo, EstadoSocio, TipoPrestamo, TipoSancion
from app.models.libro import Libro
from app.models.prestamo import Prestamo
from app.models.sancion import Sancion
from app.repositories.ejemplar_repository import EjemplarRepository
from app.repositories.libro_repository import LibroRepository
from app.repositories.prestamo_repository import PrestamoRepository
from app.repositories.reserva_repository import ReservaRepository
from app.repositories.sancion_repository import SancionRepository
from app.repositories.socio_repository import SocioRepository
from app.services.ejemplar_service import crear_ejemplar
from app.services.reserva_service import asignar_ejemplar_a_reserva_mas_vieja
from app.services.sancion_service import DIAS_SUSPENSION
from app.notifications import mensajes
from app.states.ejemplar_state import estado_de
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
libro_repo = LibroRepository()


def _to_listado(p: Prestamo) -> PrestamoListadoDTO:
    return PrestamoListadoDTO(
        id=p.id,
        numero=p.numero,
        estado=p.estado,
        tipo=p.tipo,
        fecha_inicio=p.fecha_inicio,
        fecha_vencimiento=p.fecha_vencimiento,
        fecha_devolucion=p.fecha_devolucion,
        socio_id=p.socio_id,
        socio_nombre=f"{p.socio.nombre} {p.socio.apellido}",
        ejemplar_id=p.ejemplar_id,
        ejemplar_codigo=p.ejemplar.codigo_inventario,
        libro_id=p.ejemplar.libro_id,
        libro_nombre=p.ejemplar.libro.nombre,
        libro_isbn=p.ejemplar.libro.isbn,
        libro_imagen_url=p.ejemplar.libro.imagen_url,
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
    estado_de(ejemplar).prestar(ejemplar)  # DISPONIBLE -> PRESTADO (si no, TransicionInvalida)
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
    estado_de(ejemplar).retirar_reservado(ejemplar)  # RESERVADO -> PRESTADO
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


def devolver_prestamo(
    session: Session, prestamo_id: int, sede_id: int, usuario_id: int, con_danios: bool = False
) -> Prestamo:
    """Cierra el préstamo: registra devolución, aplica sanción si hay retraso.

    Sin daños, busca la reserva más vieja para el libro:
      - si es en la MISMA sede donde se devolvió: asignada (RESERVADO)
      - si es en OTRA sede: la reserva espera su despacho, ejemplar DISPONIBLE (requiere remito)
      - si no hay ninguna: ejemplar DISPONIBLE

    Con `con_danios` (daños menores, reparable): el ejemplar pasa a EN_REPARACION, no se
    asigna a ninguna reserva y el socio queda suspendido DIAS_SUSPENSION días.

    Si el ejemplar estaba dado por PERDIDO y aparece, se levanta la baja del socio.

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
    if ejemplar.estado == EstadoEjemplar.PERDIDO:
        _levantar_baja_por_perdida(session, prestamo, hoy)  # apareció el original
    estado_de(ejemplar).devolver(ejemplar)  # PRESTADO o PERDIDO -> DISPONIBLE

    if con_danios:
        estado_de(ejemplar).enviar_a_reparacion(ejemplar)  # DISPONIBLE -> EN_REPARACION
        _suspender_por_danios(session, prestamo, hoy)
    else:
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


# ---------------------------------------------------------------------- daños y pérdida


def _agregar_observacion(actual: str | None, nueva: str) -> str:
    return f"{actual}\n{nueva}" if actual else nueva


def _suspender_por_danios(session: Session, prestamo: Prestamo, hoy: date) -> None:
    """Suspensión de DIAS_SUSPENSION días por devolver el libro con daños menores."""
    sancion = Sancion(
        tipo=TipoSancion.SUSPENSION,
        fecha_inicio=hoy,
        fecha_fin=hoy + timedelta(days=DIAS_SUSPENSION),
        motivo=f"Devolvió con daños el préstamo {prestamo.numero}",
        dias_suspension=DIAS_SUSPENSION,
        socio_id=prestamo.socio_id,
        prestamo_id=prestamo.id,
    )
    sancion = sancion_repo.add(session, sancion)
    mensajes.avisar_sancion_aplicada(session, prestamo.socio, sancion)


def _levantar_baja_por_perdida(session: Session, prestamo: Prestamo, hoy: date) -> None:
    """Levanta la sanción REPOSICION del préstamo y reactiva al socio (si estaba de baja)."""
    sancion = session.scalars(
        select(Sancion).where(
            Sancion.prestamo_id == prestamo.id,
            Sancion.tipo == TipoSancion.REPOSICION,
            Sancion.activo.is_(True),
        )
    ).first()
    if sancion is None:
        return
    sancion.activo = False
    sancion.fecha_fin = hoy
    socio = prestamo.socio
    socio.estado = EstadoSocio.ACTIVO
    mensajes.avisar_sancion_levantada(session, socio, sancion)


def marcar_perdido(session: Session, prestamo_id: int, usuario_id: int) -> Prestamo:
    """Da por perdido el ejemplar de un préstamo que nunca se devolvió (a mano, en el mostrador).

    Según la política, corresponde tras 2 meses de vencido; no se valida el plazo para poder
    demostrarlo. Efectos:
      - el ejemplar pasa a PERDIDO (no es final: si aparece se devuelve);
      - el préstamo queda VENCIDO, con la observación de que nunca fue devuelto;
      - el socio pasa a BAJA y se crea una sanción REPOSICION (vigente hasta que reponga
        una copia de una edición igual o posterior, ver `reponer_libro`).
    """
    prestamo = prestamo_repo.get_by_id(session, prestamo_id)
    if prestamo is None:
        raise ValueError(f"préstamo {prestamo_id} no existe")
    if prestamo.estado == EstadoPrestamo.FINALIZADO:
        raise ValueError(f"préstamo {prestamo_id} ya devuelto")

    ejemplar = prestamo.ejemplar
    estado_de(ejemplar).dar_por_perdido(ejemplar)  # PRESTADO -> PERDIDO

    hoy = date.today()
    prestamo.estado = EstadoPrestamo.VENCIDO
    prestamo.observaciones = _agregar_observacion(
        prestamo.observaciones,
        f"Nunca fue devuelto: ejemplar dado por perdido el {hoy:%d/%m/%Y}.",
    )

    socio = prestamo.socio
    socio.estado = EstadoSocio.BAJA
    sancion = Sancion(
        tipo=TipoSancion.REPOSICION,
        fecha_inicio=hoy,
        fecha_fin=None,
        motivo=(
            f"No devolvió el ejemplar {ejemplar.codigo_inventario} "
            f"del préstamo {prestamo.numero}"
        ),
        socio_id=socio.id,
        prestamo_id=prestamo.id,
    )
    sancion = sancion_repo.add(session, sancion)
    mensajes.avisar_sancion_aplicada(session, socio, sancion)

    session.flush()
    session.refresh(prestamo)
    return prestamo


def _es_reposicion_valida(original: Libro, repuesto: Libro) -> bool:
    """El mismo libro, o uno con el mismo título y fecha de publicación igual o posterior."""
    if repuesto.id == original.id:
        return True
    if repuesto.nombre.strip().lower() != original.nombre.strip().lower():
        return False
    if original.fecha_publicacion is None or repuesto.fecha_publicacion is None:
        return False
    return repuesto.fecha_publicacion >= original.fecha_publicacion


def reponer_libro(
    session: Session, prestamo_id: int, datos: EjemplarCreate, usuario_id: int
) -> Prestamo:
    """El socio entrega una copia de reposición: se da de alta, se cierra la pérdida y se reasocia.

    `datos` es el ejemplar nuevo (su `libro_id` debe existir en el catálogo, y ser el mismo libro
    o una edición igual o posterior). Efectos:
      - el ejemplar nuevo entra al catálogo (DISPONIBLE);
      - el ejemplar perdido pasa a INUTILIZABLE;
      - el préstamo queda FINALIZADO, con observación de la reposición;
      - se levanta la sanción REPOSICION y el socio vuelve a ACTIVO.
    """
    prestamo = prestamo_repo.get_by_id(session, prestamo_id)
    if prestamo is None:
        raise ValueError(f"préstamo {prestamo_id} no existe")
    perdido = prestamo.ejemplar
    if perdido.estado != EstadoEjemplar.PERDIDO:
        raise ValueError(
            f"el ejemplar {perdido.codigo_inventario} no está dado por perdido "
            f"(estado: {perdido.estado.value})"
        )

    original = libro_repo.get_by_id(session, perdido.libro_id, incluir_inactivos=True)
    repuesto = libro_repo.get_by_id(session, datos.libro_id, incluir_inactivos=True)
    if repuesto is None:
        raise ValueError(f"libro {datos.libro_id} no existe")
    if not _es_reposicion_valida(original, repuesto):
        raise ValueError(
            "la reposición tiene que ser del mismo libro o de una edición posterior "
            f"(perdido: «{original.nombre}» {original.fecha_publicacion}; "
            f"entregado: «{repuesto.nombre}» {repuesto.fecha_publicacion})"
        )

    nuevo = crear_ejemplar(session, datos)
    estado_de(perdido).dar_de_baja(perdido)  # PERDIDO -> INUTILIZABLE

    hoy = date.today()
    prestamo.estado = EstadoPrestamo.FINALIZADO
    prestamo.fecha_devolucion = hoy
    prestamo.observaciones = _agregar_observacion(
        prestamo.observaciones,
        f"Cerrado por reposición el {hoy:%d/%m/%Y} con el ejemplar {nuevo.codigo_inventario}.",
    )
    _levantar_baja_por_perdida(session, prestamo, hoy)

    session.flush()
    session.refresh(prestamo)
    return prestamo
