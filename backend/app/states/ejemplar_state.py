"""Patrón State para el ciclo de vida del Ejemplar.

El estado se persiste como enum (`EstadoEjemplar`); lo que este módulo agrega es el
COMPORTAMIENTO de cada estado: qué eventos admite y a qué estado lleva cada uno.
Un evento que el estado no admite lanza `TransicionInvalida`.

    DISPONIBLE --reservar-----------> RESERVADO
    DISPONIBLE --prestar------------> PRESTADO
    RESERVADO  --retirar_reservado--> PRESTADO
    RESERVADO  --liberar------------> DISPONIBLE
    PRESTADO   --devolver-----------> DISPONIBLE
    DISPONIBLE / RESERVADO --despachar--> EN_TRANSITO
    EN_TRANSITO --recibir-----------> DISPONIBLE
    DISPONIBLE / EN_TRANSITO --enviar_a_reparacion--> EN_REPARACION
    EN_REPARACION --reparar---------> DISPONIBLE
    DISPONIBLE / EN_TRANSITO / EN_REPARACION --dar_de_baja--> INUTILIZABLE   (terminal)
    PRESTADO   --dar_por_perdido----> PERDIDO        (vencido y el socio no lo devuelve)
    PERDIDO    --devolver-----------> DISPONIBLE     (apareció el ejemplar original)
    PERDIDO    --dar_de_baja--------> INUTILIZABLE   (el socio repuso una copia: el original se descarta)

Uso desde los services:

    estado_de(ejemplar).prestar(ejemplar)       # cambia ejemplar.estado o lanza TransicionInvalida
    estado_de(ejemplar).admite("despachar")     # consulta sin cambiar nada

Los estados no guardan datos (son una instancia compartida por tipo), así que el
contexto —el Ejemplar— se pasa como argumento. Este módulo no importa el modelo
`Ejemplar`: usa solo el enum, para no generar imports circulares.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.exceptions import EjemplarNoDisponible
from app.models.enums import EstadoEjemplar

if TYPE_CHECKING:
    from app.models.ejemplar import Ejemplar


class TransicionInvalida(EjemplarNoDisponible):
    """El estado actual del ejemplar no admite el evento pedido.

    Hereda de `EjemplarNoDisponible` para que sigan funcionando los handlers que ya
    traducen esa excepción (por ejemplo, al intentar prestar un ejemplar no disponible).
    """


class EstadoEjemplarState:
    """Estado base: todos los eventos son inválidos salvo que el estado concreto los sobrescriba."""

    def _invalida(self, ejemplar: Ejemplar, accion: str) -> None:
        raise TransicionInvalida(
            f"el ejemplar {ejemplar.codigo_inventario} no puede {accion}: "
            f"está {ejemplar.estado.value}"
        )

    # -- eventos ---------------------------------------------------------------

    def reservar(self, ejemplar: Ejemplar) -> None:
        self._invalida(ejemplar, "reservarse")

    def prestar(self, ejemplar: Ejemplar) -> None:
        self._invalida(ejemplar, "prestarse")

    def retirar_reservado(self, ejemplar: Ejemplar) -> None:
        self._invalida(ejemplar, "retirarse como reservado")

    def liberar(self, ejemplar: Ejemplar) -> None:
        self._invalida(ejemplar, "liberarse de su reserva")

    def devolver(self, ejemplar: Ejemplar) -> None:
        self._invalida(ejemplar, "devolverse")

    def despachar(self, ejemplar: Ejemplar) -> None:
        self._invalida(ejemplar, "despacharse")

    def recibir(self, ejemplar: Ejemplar) -> None:
        self._invalida(ejemplar, "recibirse")

    def enviar_a_reparacion(self, ejemplar: Ejemplar) -> None:
        self._invalida(ejemplar, "enviarse a reparación")

    def reparar(self, ejemplar: Ejemplar) -> None:
        self._invalida(ejemplar, "repararse")

    def dar_de_baja(self, ejemplar: Ejemplar) -> None:
        self._invalida(ejemplar, "darse de baja")

    def dar_por_perdido(self, ejemplar: Ejemplar) -> None:
        self._invalida(ejemplar, "darse por perdido")

    # -- consulta --------------------------------------------------------------

    def admite(self, evento: str) -> bool:
        """True si este estado sobrescribe `evento` (o sea, si lo admite)."""
        return getattr(type(self), evento) is not getattr(EstadoEjemplarState, evento)


class Disponible(EstadoEjemplarState):
    def reservar(self, ejemplar: Ejemplar) -> None:
        ejemplar.estado = EstadoEjemplar.RESERVADO

    def prestar(self, ejemplar: Ejemplar) -> None:
        ejemplar.estado = EstadoEjemplar.PRESTADO

    def despachar(self, ejemplar: Ejemplar) -> None:
        ejemplar.estado = EstadoEjemplar.EN_TRANSITO

    def enviar_a_reparacion(self, ejemplar: Ejemplar) -> None:
        ejemplar.estado = EstadoEjemplar.EN_REPARACION

    def dar_de_baja(self, ejemplar: Ejemplar) -> None:
        ejemplar.estado = EstadoEjemplar.INUTILIZABLE


class Reservado(EstadoEjemplarState):
    def retirar_reservado(self, ejemplar: Ejemplar) -> None:
        ejemplar.estado = EstadoEjemplar.PRESTADO

    def liberar(self, ejemplar: Ejemplar) -> None:
        ejemplar.estado = EstadoEjemplar.DISPONIBLE

    def despachar(self, ejemplar: Ejemplar) -> None:
        ejemplar.estado = EstadoEjemplar.EN_TRANSITO


class EnTransito(EstadoEjemplarState):
    def recibir(self, ejemplar: Ejemplar) -> None:
        ejemplar.estado = EstadoEjemplar.DISPONIBLE

    def enviar_a_reparacion(self, ejemplar: Ejemplar) -> None:  # llegó dañado
        ejemplar.estado = EstadoEjemplar.EN_REPARACION

    def dar_de_baja(self, ejemplar: Ejemplar) -> None:  # llegó destruido
        ejemplar.estado = EstadoEjemplar.INUTILIZABLE


class Prestado(EstadoEjemplarState):
    def devolver(self, ejemplar: Ejemplar) -> None:
        ejemplar.estado = EstadoEjemplar.DISPONIBLE

    def dar_por_perdido(self, ejemplar: Ejemplar) -> None:  # vencido y nunca lo devolvieron
        ejemplar.estado = EstadoEjemplar.PERDIDO


class Perdido(EstadoEjemplarState):
    """No es terminal: si el ejemplar aparece se devuelve; si se repone, se da de baja."""

    def devolver(self, ejemplar: Ejemplar) -> None:
        ejemplar.estado = EstadoEjemplar.DISPONIBLE

    def dar_de_baja(self, ejemplar: Ejemplar) -> None:
        ejemplar.estado = EstadoEjemplar.INUTILIZABLE


class EnReparacion(EstadoEjemplarState):
    def reparar(self, ejemplar: Ejemplar) -> None:
        ejemplar.estado = EstadoEjemplar.DISPONIBLE

    def dar_de_baja(self, ejemplar: Ejemplar) -> None:
        ejemplar.estado = EstadoEjemplar.INUTILIZABLE


class Inutilizable(EstadoEjemplarState):
    """Estado terminal: no admite ningún evento."""


ESTADOS: dict[EstadoEjemplar, EstadoEjemplarState] = {
    EstadoEjemplar.DISPONIBLE: Disponible(),
    EstadoEjemplar.RESERVADO: Reservado(),
    EstadoEjemplar.EN_TRANSITO: EnTransito(),
    EstadoEjemplar.PRESTADO: Prestado(),
    EstadoEjemplar.EN_REPARACION: EnReparacion(),
    EstadoEjemplar.PERDIDO: Perdido(),
    EstadoEjemplar.INUTILIZABLE: Inutilizable(),
}


def estado_de(ejemplar: Ejemplar) -> EstadoEjemplarState:
    """El comportamiento que corresponde al estado actual del ejemplar."""
    return ESTADOS[ejemplar.estado]
