from types import SimpleNamespace
from typing import TYPE_CHECKING, cast

import pytest

from app.models.enums import EstadoReserva as R
from app.states.reserva_state import ESTADOS, TransicionReservaInvalida, estado_de_reserva

if TYPE_CHECKING:
    from app.models.reserva import Reserva

EVENTOS = ["despachar", "habilitar_retiro", "perder_ejemplar", "retirar", "vencer", "cancelar"]

# (estado de origen, evento, estado resultante): las ÚNICAS transiciones válidas.
VALIDAS = [
    (R.PENDIENTE, "despachar", R.EN_TRANSITO),
    (R.PENDIENTE, "habilitar_retiro", R.LISTA_PARA_RETIRO),
    (R.PENDIENTE, "cancelar", R.CANCELADA),
    (R.EN_TRANSITO, "habilitar_retiro", R.LISTA_PARA_RETIRO),
    (R.EN_TRANSITO, "perder_ejemplar", R.PENDIENTE),
    (R.EN_TRANSITO, "cancelar", R.CANCELADA),
    (R.LISTA_PARA_RETIRO, "retirar", R.CUMPLIDA),
    (R.LISTA_PARA_RETIRO, "vencer", R.VENCIDA),
    (R.LISTA_PARA_RETIRO, "cancelar", R.CANCELADA),
]
TERMINALES = [R.CUMPLIDA, R.VENCIDA, R.CANCELADA]


def _reserva(estado: R) -> "Reserva":
    # Doble de prueba: los estados solo leen `id` y `estado`. El cast es para el chequeador de tipos.
    return cast("Reserva", SimpleNamespace(id=7, estado=estado))


def test_todos_los_estados_tienen_comportamiento():
    assert set(ESTADOS) == set(R)


@pytest.mark.parametrize("origen, evento, destino", VALIDAS)
def test_transicion_valida(origen, evento, destino):
    reserva = _reserva(origen)
    assert estado_de_reserva(reserva).admite(evento)
    estado_de_reserva(reserva).exigir(reserva, evento)  # no lanza ni cambia nada
    assert reserva.estado == origen
    getattr(estado_de_reserva(reserva), evento)(reserva)
    assert reserva.estado == destino


@pytest.mark.parametrize(
    "origen, evento",
    [(o, ev) for o in R for ev in EVENTOS if (o, ev) not in {(v[0], v[1]) for v in VALIDAS}],
)
def test_transicion_invalida_no_cambia_el_estado(origen, evento):
    reserva = _reserva(origen)
    assert not estado_de_reserva(reserva).admite(evento)
    with pytest.raises(TransicionReservaInvalida):
        estado_de_reserva(reserva).exigir(reserva, evento)
    with pytest.raises(TransicionReservaInvalida):
        getattr(estado_de_reserva(reserva), evento)(reserva)
    assert reserva.estado == origen


def test_el_mensaje_indica_numero_y_estado():
    reserva = _reserva(R.CANCELADA)
    with pytest.raises(TransicionReservaInvalida, match="reserva 7.*CANCELADA"):
        estado_de_reserva(reserva).cancelar(reserva)


@pytest.mark.parametrize("estado", TERMINALES)
def test_los_estados_finales_no_admiten_nada(estado):
    assert not any(estado_de_reserva(_reserva(estado)).admite(ev) for ev in EVENTOS)
