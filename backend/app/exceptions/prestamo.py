from app.exceptions.base import BibliotecaError


class LimitePrestamosExcedido(BibliotecaError):
    """El socio ya alcanzó el límite de préstamos activos."""


class SocioSancionado(BibliotecaError):
    """El socio tiene una sanción vigente y no puede retirar libros.

    Nótese que cualquier tipo de sanción bloquea la operación: `MULTA` debe pagarse,
    `SUSPENSION` debe pasar el tiempo. El bloqueo es el mismo en ambos casos.
    """


class EjemplarNoDisponible(BibliotecaError):
    """El ejemplar no está DISPONIBLE para prestar.

    Causas posibles: está prestado, en tránsito, reservado o inutilizado.
    """
