"""reserva_service: alta (local / sin stock), ETA, llegada de remito, FIFO en la
devolución, retiro, cancelación y vencimiento de la ventana de retiro."""

from datetime import date, timedelta

import pytest

from app.dtos.remito_dto import RemitoCreate
from app.dtos.reserva_dto import ReservaCreate
from app.exceptions import ReservaDuplicada
from app.models.enums import (
    EstadoEjemplar,
    EstadoPrestamo,
    EstadoRemito,
    EstadoReserva,
    MotivoTraslado,
)
from app.repositories.remito_repository import RemitoRepository
from app.services import remito_service
from app.services.prestamo_service import devolver_prestamo
from app.services.reserva_service import (
    DIAS_RETRASO_PROMEDIO,
    DIAS_TRANSITO,
    calcular_eta,
    cancelar_reserva,
    crear_reserva,
    eta_para_reserva,
    procesar_retiro,
    procesar_vencimientos,
)
from app.utils.fechas import sumar_dias_habiles

remito_repo = RemitoRepository()

HOY = date.today()


def _reservar(session, socio, libro, sede, usuario):
    return crear_reserva(
        session,
        ReservaCreate(socio_id=socio.id, libro_id=libro.id, sede_retiro_id=sede.id),
        usuario_id=usuario.id,
    )


def _prestado(fabrica, libro, sede, vence: date):
    """Ejemplar PRESTADO (a un socio cualquiera) con préstamo abierto que vence en `vence`."""
    ej = fabrica.ejemplar(libro, sede, EstadoEjemplar.PRESTADO)
    fabrica.prestamo(fabrica.socio(sede), ej, fecha_vencimiento=vence)
    return ej


# ------------------------------------------------------------------------- alta


def test_reservar_con_ejemplar_local_queda_lista_para_retiro(session, fabrica):
    sede = fabrica.sede()
    libro = fabrica.libro()
    ej = fabrica.ejemplar(libro, sede)

    reserva = _reservar(session, fabrica.socio(sede), libro, sede, fabrica.usuario(sede=sede))

    assert (reserva.estado, reserva.ejemplar_id, ej.estado) == (
        EstadoReserva.LISTA_PARA_RETIRO,
        ej.id,
        EstadoEjemplar.RESERVADO,
    )


def test_reservar_con_ejemplar_local_abre_ventana_de_2_dias_habiles(session, fabrica):
    sede = fabrica.sede()
    libro = fabrica.libro()
    fabrica.ejemplar(libro, sede)

    reserva = _reservar(session, fabrica.socio(sede), libro, sede, fabrica.usuario(sede=sede))

    assert reserva.fecha_vencimiento_retiro == sumar_dias_habiles(HOY, 2)


def test_reservar_sin_disponibilidad_queda_pendiente(session, fabrica):
    sede = fabrica.sede()
    libro = fabrica.libro()
    _prestado(fabrica, libro, sede, vence=HOY + timedelta(days=10))

    reserva = _reservar(session, fabrica.socio(sede), libro, sede, fabrica.usuario(sede=sede))

    assert (reserva.estado, reserva.ejemplar_id) == (EstadoReserva.PENDIENTE, None)


def test_reservar_dos_veces_el_mismo_libro_falla(session, fabrica):
    sede = fabrica.sede()
    libro = fabrica.libro()
    socio, biblio = fabrica.socio(sede), fabrica.usuario(sede=sede)
    _reservar(session, socio, libro, sede, biblio)

    with pytest.raises(ReservaDuplicada):
        _reservar(session, socio, libro, sede, biblio)


def test_reservar_con_ejemplar_en_otra_sede_lo_encola_en_remito(session, fabrica):
    centro, norte = fabrica.sede("Centro"), fabrica.sede("Norte")
    libro = fabrica.libro()
    ej = fabrica.ejemplar(libro, centro)

    _reservar(session, fabrica.socio(norte), libro, norte, fabrica.usuario(sede=norte))

    remito = remito_repo.get_en_transito_de_ejemplar(session, ej.id)
    assert (remito.estado, remito.sede_destino_id, ej.estado) == (
        EstadoRemito.CREADO,
        norte.id,
        EstadoEjemplar.RESERVADO,
    )


# -------------------------------------------------------------------------- ETA


def test_eta_con_ejemplar_prestado_es_vencimiento_mas_retraso_medio(session, fabrica):
    sede = fabrica.sede()
    libro = fabrica.libro()
    vence = HOY + timedelta(days=10)
    _prestado(fabrica, libro, sede, vence)

    assert calcular_eta(session, libro.id, sede.id) == sumar_dias_habiles(
        vence, DIAS_RETRASO_PROMEDIO
    )


def test_eta_con_ejemplar_disponible_en_otra_sede_suma_transito(session, fabrica):
    centro, norte = fabrica.sede("Centro"), fabrica.sede("Norte")
    libro = fabrica.libro()
    fabrica.ejemplar(libro, centro)

    assert calcular_eta(session, libro.id, norte.id) == sumar_dias_habiles(HOY, DIAS_TRANSITO)


def test_eta_descuenta_las_reservas_que_ya_esperan(session, fabrica):
    """Con una reserva PENDIENTE delante, al siguiente le toca el 2.º candidato."""
    sede = fabrica.sede()
    libro = fabrica.libro()
    vence_1, vence_2 = HOY + timedelta(days=5), HOY + timedelta(days=20)
    _prestado(fabrica, libro, sede, vence_1)
    _prestado(fabrica, libro, sede, vence_2)
    _reservar(session, fabrica.socio(sede), libro, sede, fabrica.usuario(sede=sede))

    assert calcular_eta(session, libro.id, sede.id) == sumar_dias_habiles(
        vence_2, DIAS_RETRASO_PROMEDIO
    )


def test_eta_es_none_si_no_alcanzan_los_ejemplares(session, fabrica):
    sede = fabrica.sede()
    libro = fabrica.libro()
    _prestado(fabrica, libro, sede, HOY + timedelta(days=5))
    _reservar(session, fabrica.socio(sede), libro, sede, fabrica.usuario(sede=sede))

    assert calcular_eta(session, libro.id, sede.id) is None


def test_eta_para_reserva_marca_disponible_ahora(session, fabrica):
    sede = fabrica.sede()
    libro = fabrica.libro()
    fabrica.ejemplar(libro, sede)

    assert eta_para_reserva(session, libro.id, sede.id).disponible_ahora is True


# ---------------------------------------------------------------- llegada de remito


def test_llega_remito_sin_reservas_ejemplar_disponible_en_destino(session, fabrica):
    centro, norte = fabrica.sede("Centro"), fabrica.sede("Norte")
    biblio = fabrica.usuario(sede=centro)
    ej = fabrica.ejemplar(fabrica.libro(), centro)
    remito = remito_service.crear_remito(
        session,
        RemitoCreate(
            motivo_traslado=MotivoTraslado.REBALANCEO,
            sede_origen_id=centro.id, sede_destino_id=norte.id, ejemplar_ids=[ej.id],
        ),
        biblio.id,
    )
    remito_service.despachar(session, remito.id, biblio.id)

    remito_service.recibir(session, remito.id, biblio.id)

    assert (ej.estado, ej.sede_actual_id) == (EstadoEjemplar.DISPONIBLE, norte.id)


def test_llega_remito_con_reserva_ejemplar_reservado_y_reserva_lista(session, fabrica):
    """Reserva en Norte servida con el ejemplar de Centro: crear → despachar → recibir."""
    centro, norte = fabrica.sede("Centro"), fabrica.sede("Norte")
    biblio = fabrica.usuario(sede=centro)
    libro = fabrica.libro()
    ej = fabrica.ejemplar(libro, centro)
    reserva = _reservar(session, fabrica.socio(norte), libro, norte, biblio)
    remito = remito_repo.get_en_transito_de_ejemplar(session, ej.id)
    remito_service.despachar(session, remito.id, biblio.id)

    remito_service.recibir(session, remito.id, biblio.id)

    assert (ej.estado, ej.sede_actual_id, reserva.estado) == (
        EstadoEjemplar.RESERVADO,
        norte.id,
        EstadoReserva.LISTA_PARA_RETIRO,
    )


def test_despachar_remito_pasa_la_reserva_a_en_transito(session, fabrica):
    centro, norte = fabrica.sede("Centro"), fabrica.sede("Norte")
    biblio = fabrica.usuario(sede=centro)
    libro = fabrica.libro()
    ej = fabrica.ejemplar(libro, centro)
    reserva = _reservar(session, fabrica.socio(norte), libro, norte, biblio)
    remito = remito_repo.get_en_transito_de_ejemplar(session, ej.id)

    remito_service.despachar(session, remito.id, biblio.id)

    assert (ej.estado, reserva.estado) == (EstadoEjemplar.EN_TRANSITO, EstadoReserva.EN_TRANSITO)


# --------------------------------------------------------------- FIFO en devolución


def test_devolucion_asigna_a_la_reserva_mas_vieja_fifo(session, fabrica):
    sede = fabrica.sede()
    biblio = fabrica.usuario(sede=sede)
    libro = fabrica.libro()
    ej = fabrica.ejemplar(libro, sede, EstadoEjemplar.PRESTADO)
    prestamo = fabrica.prestamo(fabrica.socio(sede), ej)
    # Se insertan al revés a propósito: la más nueva primero (id menor).
    nueva = fabrica.reserva(fabrica.socio(sede), libro, sede, fecha_reserva=HOY - timedelta(days=1))
    vieja = fabrica.reserva(fabrica.socio(sede), libro, sede, fecha_reserva=HOY - timedelta(days=5))

    devolver_prestamo(session, prestamo.id, sede_id=sede.id, usuario_id=biblio.id)

    assert (vieja.estado, vieja.ejemplar_id, nueva.estado) == (
        EstadoReserva.LISTA_PARA_RETIRO,
        ej.id,
        EstadoReserva.PENDIENTE,
    )


def test_devolucion_con_cola_deja_el_ejemplar_reservado(session, fabrica):
    sede = fabrica.sede()
    biblio = fabrica.usuario(sede=sede)
    libro = fabrica.libro()
    ej = fabrica.ejemplar(libro, sede, EstadoEjemplar.PRESTADO)
    prestamo = fabrica.prestamo(fabrica.socio(sede), ej)
    fabrica.reserva(fabrica.socio(sede), libro, sede)

    devolver_prestamo(session, prestamo.id, sede_id=sede.id, usuario_id=biblio.id)

    assert ej.estado is EstadoEjemplar.RESERVADO


# ------------------------------------------------------------------------ retiro


def test_retirar_reserva_la_cumple_y_crea_el_prestamo(session, fabrica):
    sede = fabrica.sede()
    biblio = fabrica.usuario(sede=sede)
    libro = fabrica.libro()
    ej = fabrica.ejemplar(libro, sede)
    reserva = _reservar(session, fabrica.socio(sede), libro, sede, biblio)

    prestamo = procesar_retiro(session, reserva.id, sede.id, biblio.id)

    assert (reserva.estado, prestamo.estado, ej.estado) == (
        EstadoReserva.CUMPLIDA,
        EstadoPrestamo.ACTIVO,
        EstadoEjemplar.PRESTADO,
    )


def test_retirar_en_otra_sede_falla(session, fabrica):
    centro, norte = fabrica.sede("Centro"), fabrica.sede("Norte")
    biblio = fabrica.usuario(sede=centro)
    libro = fabrica.libro()
    fabrica.ejemplar(libro, centro)
    reserva = _reservar(session, fabrica.socio(centro), libro, centro, biblio)

    with pytest.raises(ValueError, match="se retira en la sede"):
        procesar_retiro(session, reserva.id, norte.id, biblio.id)


# -------------------------------------------------------------------- cancelación


def test_cancelar_reserva_lista_libera_el_ejemplar(session, fabrica):
    sede = fabrica.sede()
    biblio = fabrica.usuario(sede=sede)
    libro = fabrica.libro()
    ej = fabrica.ejemplar(libro, sede)
    reserva = _reservar(session, fabrica.socio(sede), libro, sede, biblio)

    cancelar_reserva(session, reserva.id, biblio.id)

    assert (reserva.estado, ej.estado) == (EstadoReserva.CANCELADA, EstadoEjemplar.DISPONIBLE)


# -------------------------------------------------------------------- vencimientos


def test_procesar_vencimientos_expira_reserva_no_retirada(session, fabrica):
    sede = fabrica.sede()
    libro = fabrica.libro()
    ej = fabrica.ejemplar(libro, sede, EstadoEjemplar.RESERVADO)
    reserva = fabrica.reserva(
        fabrica.socio(sede), libro, sede,
        estado=EstadoReserva.LISTA_PARA_RETIRO, ejemplar=ej,
        fecha_vencimiento_retiro=HOY - timedelta(days=1),
    )

    procesar_vencimientos(session, usuario_id=fabrica.usuario(sede=sede).id)

    assert reserva.estado is EstadoReserva.VENCIDA


def test_procesar_vencimientos_sin_cola_libera_el_ejemplar(session, fabrica):
    sede = fabrica.sede()
    libro = fabrica.libro()
    ej = fabrica.ejemplar(libro, sede, EstadoEjemplar.RESERVADO)
    fabrica.reserva(
        fabrica.socio(sede), libro, sede,
        estado=EstadoReserva.LISTA_PARA_RETIRO, ejemplar=ej,
        fecha_vencimiento_retiro=HOY - timedelta(days=1),
    )

    procesar_vencimientos(session, usuario_id=fabrica.usuario(sede=sede).id)

    assert ej.estado is EstadoEjemplar.DISPONIBLE


def test_procesar_vencimientos_pasa_el_ejemplar_al_siguiente_en_cola(session, fabrica):
    sede = fabrica.sede()
    libro = fabrica.libro()
    ej = fabrica.ejemplar(libro, sede, EstadoEjemplar.RESERVADO)
    fabrica.reserva(
        fabrica.socio(sede), libro, sede, fecha_reserva=HOY - timedelta(days=5),
        estado=EstadoReserva.LISTA_PARA_RETIRO, ejemplar=ej,
        fecha_vencimiento_retiro=HOY - timedelta(days=1),
    )
    siguiente = fabrica.reserva(fabrica.socio(sede), libro, sede, fecha_reserva=HOY - timedelta(days=2))

    procesar_vencimientos(session, usuario_id=fabrica.usuario(sede=sede).id)

    assert (siguiente.estado, siguiente.ejemplar_id) == (EstadoReserva.LISTA_PARA_RETIRO, ej.id)


def test_procesar_vencimientos_no_toca_reservas_en_plazo(session, fabrica):
    sede = fabrica.sede()
    libro = fabrica.libro()
    ej = fabrica.ejemplar(libro, sede, EstadoEjemplar.RESERVADO)
    reserva = fabrica.reserva(
        fabrica.socio(sede), libro, sede,
        estado=EstadoReserva.LISTA_PARA_RETIRO, ejemplar=ej,
        fecha_vencimiento_retiro=HOY,  # vence hoy: todavía se puede retirar
    )

    procesar_vencimientos(session, usuario_id=fabrica.usuario(sede=sede).id)

    assert reserva.estado is EstadoReserva.LISTA_PARA_RETIRO
