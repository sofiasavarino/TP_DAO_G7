from types import SimpleNamespace
from typing import TYPE_CHECKING, cast

import pytest

from app.models.enums import EstadoEjemplar as E
from app.states.ejemplar_state import ESTADOS, TransicionInvalida, estado_de

if TYPE_CHECKING:
    from app.models.ejemplar import Ejemplar

EVENTOS = [
    "reservar", "prestar", "retirar_reservado", "liberar", "devolver",
    "despachar", "recibir", "enviar_a_reparacion", "reparar", "dar_de_baja", "dar_por_perdido",
]

# (estado de origen, evento, estado resultante): las ÚNICAS transiciones válidas.
VALIDAS = [
    (E.DISPONIBLE, "reservar", E.RESERVADO),
    (E.DISPONIBLE, "prestar", E.PRESTADO),
    (E.DISPONIBLE, "despachar", E.EN_TRANSITO),
    (E.DISPONIBLE, "enviar_a_reparacion", E.EN_REPARACION),
    (E.DISPONIBLE, "dar_de_baja", E.INUTILIZABLE),
    (E.RESERVADO, "retirar_reservado", E.PRESTADO),
    (E.RESERVADO, "liberar", E.DISPONIBLE),
    (E.RESERVADO, "despachar", E.EN_TRANSITO),
    (E.EN_TRANSITO, "recibir", E.DISPONIBLE),
    (E.EN_TRANSITO, "enviar_a_reparacion", E.EN_REPARACION),
    (E.EN_TRANSITO, "dar_de_baja", E.INUTILIZABLE),
    (E.PRESTADO, "devolver", E.DISPONIBLE),
    (E.PRESTADO, "dar_por_perdido", E.PERDIDO),
    (E.PERDIDO, "devolver", E.DISPONIBLE),  # apareció el original
    (E.PERDIDO, "dar_de_baja", E.INUTILIZABLE),  # se repuso una copia
    (E.EN_REPARACION, "reparar", E.DISPONIBLE),
    (E.EN_REPARACION, "dar_de_baja", E.INUTILIZABLE),
]


def _ejemplar(estado: E) -> "Ejemplar":
    # Doble de prueba: los estados solo leen `codigo_inventario` y `estado`. El cast es para el chequeador de tipos.
    return cast("Ejemplar", SimpleNamespace(codigo_inventario="E-0001", estado=estado))


def test_todos_los_estados_tienen_comportamiento():
    assert set(ESTADOS) == set(E)


@pytest.mark.parametrize("origen, evento, destino", VALIDAS)
def test_transicion_valida(origen, evento, destino):
    ejemplar = _ejemplar(origen)
    assert estado_de(ejemplar).admite(evento)
    getattr(estado_de(ejemplar), evento)(ejemplar)
    assert ejemplar.estado == destino


@pytest.mark.parametrize(
    "origen, evento",
    [(o, ev) for o in E for ev in EVENTOS if (o, ev) not in {(v[0], v[1]) for v in VALIDAS}],
)
def test_transicion_invalida_no_cambia_el_estado(origen, evento):
    ejemplar = _ejemplar(origen)
    assert not estado_de(ejemplar).admite(evento)
    with pytest.raises(TransicionInvalida):
        getattr(estado_de(ejemplar), evento)(ejemplar)
    assert ejemplar.estado == origen


def test_el_mensaje_indica_codigo_y_estado():
    ejemplar = _ejemplar(E.RESERVADO)
    with pytest.raises(TransicionInvalida, match="E-0001.*RESERVADO"):
        estado_de(ejemplar).prestar(ejemplar)  # un reservado no se presta a otro socio


def test_inutilizable_es_terminal():
    assert not any(estado_de(_ejemplar(E.INUTILIZABLE)).admite(ev) for ev in EVENTOS)
