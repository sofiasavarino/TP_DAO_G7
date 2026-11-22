"""Patrón State para el ciclo de vida de la Reserva.

El estado se persiste como enum (`EstadoReserva`); este módulo agrega el COMPORTAMIENTO de
cada estado: qué eventos admite y a qué estado lleva cada uno. Un evento que el estado no
admite lanza `TransicionReservaInvalida`.

    PENDIENTE --despachar--------------------> EN_TRANSITO      (sale el remito con su ejemplar)
    PENDIENTE / EN_TRANSITO --habilitar_retiro--> LISTA_PARA_RETIRO (el ejemplar está en la sede de retiro)
    EN_TRANSITO --perder_ejemplar------------> PENDIENTE        (el ejemplar llegó con incidencia)
    LISTA_PARA_RETIRO --retirar--------------> CUMPLIDA         (nace el préstamo)
    LISTA_PARA_RETIRO --vencer---------------> VENCIDA          (pasó la ventana de retiro)
    PENDIENTE / EN_TRANSITO / LISTA_PARA_RETIRO --cancelar--> CANCELADA
    CUMPLIDA, VENCIDA y CANCELADA son terminales.

Los estados solo cambian `reserva.estado`. Quien llama (el service) se ocupa del resto:
fechas, `ejemplar_id`, el ejemplar mismo y los avisos al socio.

Uso:
    estado_de_reserva(reserva).cancelar(reserva)          # cambia el estado o lanza la excepción
    estado_de_reserva(reserva).exigir(reserva, "retirar")  # valida sin cambiar nada
    estado_de_reserva(reserva).admite("vencer")            # consulta

Este módulo no importa el modelo `Reserva` (solo el enum), para evitar imports circulares.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.exceptions import BibliotecaError
from app.models.enums import EstadoReserva

if TYPE_CHECKING:
    from app.models.reserva import Reserva


class TransicionReservaInvalida(BibliotecaError):
    """El estado actual de la reserva no admite el evento pedido."""


class EstadoReservaState:
    """Estado base: todos los eventos son inválidos salvo que el estado concreto los sobrescriba."""

    def _invalida(self, reserva: Reserva, accion: str) -> None:
        raise TransicionReservaInvalida(
            f"la reserva {reserva.id} no puede {accion}: está {reserva.estado.value}"
        )

    # -- eventos ---------------------------------------------------------------

    def despachar(self, reserva: Reserva) -> None:
        self._invalida(reserva, "despacharse")

    def habilitar_retiro(self, reserva: Reserva) -> None:
        self._invalida(reserva, "habilitarse para el retiro")

    def perder_ejemplar(self, reserva: Reserva) -> None:
        self._invalida(reserva, "perder su ejemplar")

    def retirar(self, reserva: Reserva) -> None:
        self._invalida(reserva, "retirarse")

    def vencer(self, reserva: Reserva) -> None:
        self._invalida(reserva, "vencer")

    def cancelar(self, reserva: Reserva) -> None:
        self._invalida(reserva, "cancelarse")

    # -- consulta --------------------------------------------------------------

    def admite(self, evento: str) -> bool:
        """True si este estado sobrescribe `evento` (o sea, si lo admite)."""
        return getattr(type(self), evento) is not getattr(EstadoReservaState, evento)

    def exigir(self, reserva: Reserva, evento: str) -> None:
        """Lanza `TransicionReservaInvalida` si no se admite `evento`; si se admite, no hace nada.

        Sirve para validar al principio de una operación larga, antes de tocar nada.
        """
        if not self.admite(evento):
            getattr(self, evento)(reserva)  # el método base lanza la excepción con su mensaje


class Pendiente(EstadoReservaState):
    def despachar(self, reserva: Reserva) -> None:
        reserva.estado = EstadoReserva.EN_TRANSITO

    def habilitar_retiro(self, reserva: Reserva) -> None:
        reserva.estado = EstadoReserva.LISTA_PARA_RETIRO

    def cancelar(self, reserva: Reserva) -> None:
        reserva.estado = EstadoReserva.CANCELADA


class EnTransito(EstadoReservaState):
    def habilitar_retiro(self, reserva: Reserva) -> None:
        reserva.estado = EstadoReserva.LISTA_PARA_RETIRO

    def perder_ejemplar(self, reserva: Reserva) -> None:
        reserva.estado = EstadoReserva.PENDIENTE

    def cancelar(self, reserva: Reserva) -> None:
        reserva.estado = EstadoReserva.CANCELADA


class ListaParaRetiro(EstadoReservaState):
    def retirar(self, reserva: Reserva) -> None:
        reserva.estado = EstadoReserva.CUMPLIDA

    def vencer(self, reserva: Reserva) -> None:
        reserva.estado = EstadoReserva.VENCIDA

    def cancelar(self, reserva: Reserva) -> None:
        reserva.estado = EstadoReserva.CANCELADA


class Cumplida(EstadoReservaState):
    """Terminal."""


class Vencida(EstadoReservaState):
    """Terminal."""


class Cancelada(EstadoReservaState):
    """Terminal."""


ESTADOS: dict[EstadoReserva, EstadoReservaState] = {
    EstadoReserva.PENDIENTE: Pendiente(),
    EstadoReserva.EN_TRANSITO: EnTransito(),
    EstadoReserva.LISTA_PARA_RETIRO: ListaParaRetiro(),
    EstadoReserva.CUMPLIDA: Cumplida(),
    EstadoReserva.VENCIDA: Vencida(),
    EstadoReserva.CANCELADA: Cancelada(),
}


def estado_de_reserva(reserva: Reserva) -> EstadoReservaState:
    """El comportamiento que corresponde al estado actual de la reserva."""
    return ESTADOS[reserva.estado]
