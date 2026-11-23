"""Tests del nuevo comportamiento de `cancelar`/`vencer` en el State de Reserva."""

from datetime import date

import pytest

from app.models.ejemplar import Ejemplar
from app.models.enums import EstadoEjemplar, EstadoReserva
from app.models.reserva import Reserva
from app.states.reserva_state import TransicionReservaInvalida, estado_de_reserva


def res(estado: EstadoReserva, id_: int = 1) -> Reserva:
    return Reserva(
        id=id_,
        estado=estado,
        fecha_reserva=date(2026, 11, 1),
        socio_id=1,
        libro_id=1,
        sede_retiro_id=1,
    )


def ej_reservado(id_: int = 5) -> Ejemplar:
    return Ejemplar(
        id=id_,
        codigo_inventario=f"E-{id_}",
        estado=EstadoEjemplar.RESERVADO,
        libro_id=1,
        sede_origen_id=1,
        sede_actual_id=1,
    )


@pytest.mark.parametrize("estado", list(EstadoReserva))
def test_solo_reservas_vivas_se_pueden_cancelar(estado):
    reserva = res(estado)
    vivas = (
        EstadoReserva.PENDIENTE,
        EstadoReserva.EN_TRANSITO,
        EstadoReserva.LISTA_PARA_RETIRO,
    )
    if estado in vivas:
        estado_de_reserva(reserva).cancelar(reserva)
        assert reserva.estado is EstadoReserva.CANCELADA
    else:
        with pytest.raises(TransicionReservaInvalida):
            estado_de_reserva(reserva).cancelar(reserva)


def test_lista_para_retiro_cancelar_suelta_el_ejemplar():
    reserva = res(EstadoReserva.LISTA_PARA_RETIRO)
    ejemplar = ej_reservado()
    estado_de_reserva(reserva).cancelar(reserva, ejemplar, viaja_en_remito=False)
    assert reserva.estado is EstadoReserva.CANCELADA
    assert ejemplar.estado is EstadoEjemplar.DISPONIBLE


def test_lista_para_retiro_cancelar_no_suelta_si_viaja_en_remito():
    reserva = res(EstadoReserva.LISTA_PARA_RETIRO)
    ejemplar = ej_reservado()
    estado_de_reserva(reserva).cancelar(reserva, ejemplar, viaja_en_remito=True)
    assert reserva.estado is EstadoReserva.CANCELADA
    assert ejemplar.estado is EstadoEjemplar.RESERVADO  # la recepción lo reasigna


@pytest.mark.parametrize("estado", [EstadoReserva.PENDIENTE, EstadoReserva.EN_TRANSITO])
def test_cancelar_en_pendiente_o_transito_no_toca_el_ejemplar(estado):
    reserva = res(estado)
    ejemplar = ej_reservado()
    estado_de_reserva(reserva).cancelar(reserva, ejemplar, viaja_en_remito=False)
    assert reserva.estado is EstadoReserva.CANCELADA
    assert ejemplar.estado is EstadoEjemplar.RESERVADO


def test_vencer_solo_lista_para_retiro_y_suelta():
    reserva = res(EstadoReserva.LISTA_PARA_RETIRO)
    ejemplar = ej_reservado()
    estado_de_reserva(reserva).vencer(reserva, ejemplar)
    assert reserva.estado is EstadoReserva.VENCIDA
    assert ejemplar.estado is EstadoEjemplar.DISPONIBLE

    otra = res(EstadoReserva.PENDIENTE, 2)
    with pytest.raises(TransicionReservaInvalida):
        estado_de_reserva(otra).vencer(otra)
