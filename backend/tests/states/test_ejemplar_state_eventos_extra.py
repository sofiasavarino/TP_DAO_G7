"""Tests de los eventos nuevos del State de Ejemplar (ETA, soltar, incidencias, aparecido)."""

from datetime import date, timedelta

import pytest

from app.models.ejemplar import Ejemplar
from app.models.enums import EstadoEjemplar
from app.states.ejemplar_state import (
    ContextoEta,
    TransicionInvalida,
    estado_de,
)
from app.utils.fechas import sumar_dias_habiles


def ej(estado: EstadoEjemplar, id_: int = 1, sede: int = 1) -> Ejemplar:
    return Ejemplar(
        id=id_,
        codigo_inventario=f"E-{id_}",
        estado=estado,
        libro_id=1,
        sede_origen_id=sede,
        sede_actual_id=sede,
    )


def ctx(hoy: date, sede: int, vencimiento: date | None = None) -> ContextoEta:
    return ContextoEta(
        hoy=hoy,
        sede_retiro_id=sede,
        dias_transito=3,
        dias_retraso_promedio=2,
        vencimiento_de=lambda _id: vencimiento,
    )


# -- soltar: no-op salvo en Reservado -------------------------------------------------


def test_soltar_reservado_pasa_a_disponible():
    ejemplar = ej(EstadoEjemplar.RESERVADO)
    estado_de(ejemplar).soltar(ejemplar)
    assert ejemplar.estado is EstadoEjemplar.DISPONIBLE


@pytest.mark.parametrize(
    "estado",
    [
        EstadoEjemplar.EN_TRANSITO,
        EstadoEjemplar.PRESTADO,
        EstadoEjemplar.EN_REPARACION,
        EstadoEjemplar.PERDIDO,
        EstadoEjemplar.INUTILIZABLE,
    ],
)
def test_soltar_es_noop_en_los_demas_estados(estado):
    ejemplar = ej(estado)
    estado_de(ejemplar).soltar(ejemplar)
    assert ejemplar.estado is estado


# -- despachar: devuelve si la reserva viaja ------------------------------------------


def test_despachar_devuelve_true_solo_si_esta_reservado():
    disponible = ej(EstadoEjemplar.DISPONIBLE, 1)
    reservado = ej(EstadoEjemplar.RESERVADO, 2)
    assert estado_de(disponible).despachar(disponible) is False
    assert estado_de(reservado).despachar(reservado) is True
    assert disponible.estado is EstadoEjemplar.EN_TRANSITO
    assert reservado.estado is EstadoEjemplar.EN_TRANSITO


# -- recibir con incidencia -----------------------------------------------------------


def test_recibir_con_incidencia_segun_tipo():
    roto = ej(EstadoEjemplar.EN_TRANSITO, 1)
    estado_de(roto).recibir_con_incidencia(roto, EstadoEjemplar.EN_REPARACION)
    assert roto.estado is EstadoEjemplar.EN_REPARACION

    destruido = ej(EstadoEjemplar.EN_TRANSITO, 2)
    estado_de(destruido).recibir_con_incidencia(destruido, EstadoEjemplar.INUTILIZABLE)
    assert destruido.estado is EstadoEjemplar.INUTILIZABLE


def test_recibir_con_incidencia_invalida_en_otro_estado():
    ejemplar = ej(EstadoEjemplar.DISPONIBLE)
    with pytest.raises(TransicionInvalida):
        estado_de(ejemplar).recibir_con_incidencia(ejemplar, EstadoEjemplar.EN_REPARACION)


# -- disponible_desde (polimorfismo para la ETA) --------------------------------------


def test_disponible_desde_disponible():
    hoy = date(2026, 11, 23)
    local = ej(EstadoEjemplar.DISPONIBLE, 1, sede=1)
    ajeno = ej(EstadoEjemplar.DISPONIBLE, 2, sede=2)
    assert estado_de(local).disponible_desde(local, ctx(hoy, 1)) == hoy
    assert estado_de(ajeno).disponible_desde(ajeno, ctx(hoy, 1)) == hoy + timedelta(days=3)


def test_disponible_desde_prestado_suma_retraso_y_transito():
    hoy = date(2026, 11, 23)
    vencimiento = hoy - timedelta(days=5)
    local = ej(EstadoEjemplar.PRESTADO, 1, sede=1)
    ajeno = ej(EstadoEjemplar.PRESTADO, 2, sede=2)
    base = sumar_dias_habiles(vencimiento, 2)
    assert estado_de(local).disponible_desde(local, ctx(hoy, 1, vencimiento)) == base
    assert estado_de(ajeno).disponible_desde(ajeno, ctx(hoy, 1, vencimiento)) == sumar_dias_habiles(base, 3)


def test_disponible_desde_no_estimable_y_no_llama_al_callback():
    hoy = date(2026, 11, 23)
    llamadas = []

    def vencimiento_de(_id):
        llamadas.append(_id)
        return hoy

    contexto = ContextoEta(hoy, 1, 3, 2, vencimiento_de)
    reservado = ej(EstadoEjemplar.RESERVADO)
    assert estado_de(reservado).disponible_desde(reservado, contexto) is None
    assert llamadas == []


# -- devolver con callback (apareció un perdido) --------------------------------------


def test_devolver_perdido_ejecuta_callback():
    ejemplar = ej(EstadoEjemplar.PERDIDO)
    llamadas = []
    estado_de(ejemplar).devolver(ejemplar, al_aparecer=lambda: llamadas.append(1))
    assert ejemplar.estado is EstadoEjemplar.DISPONIBLE
    assert llamadas == [1]


def test_devolver_prestado_ignora_callback():
    ejemplar = ej(EstadoEjemplar.PRESTADO)
    llamadas = []
    estado_de(ejemplar).devolver(ejemplar, al_aparecer=lambda: llamadas.append(1))
    assert ejemplar.estado is EstadoEjemplar.DISPONIBLE
    assert llamadas == []
