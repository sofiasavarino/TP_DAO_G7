from app.exceptions.base import BibliotecaError


class ReservaNoEncontrada(BibliotecaError):
    """La reserva buscada no existe (por id o id de ejemplar)."""


class EjemplarNoDisponibleParaAsignar(BibliotecaError):
    """No hay ejemplar disponible para asignar a una reserva.

    Se lanza cuando el libro no tiene copias en estado DISPONIBLE en la red;
    la reserva puede quedar como PENDIENTE, pero el sistema no puede prometer nada.
    """
