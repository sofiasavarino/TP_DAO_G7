from app.exceptions.base import BibliotecaError


class LibroNoEncontrado(BibliotecaError):
    """El libro buscado por id/ISBN/título no existe."""


class LibroConPrestamosActivos(BibliotecaError):
    """No se puede inhabilitar/eliminar del catálogo un libro que tiene préstamos abiertos."""


class IsbnDuplicado(BibliotecaError):
    """Ya hay otro libro del catálogo con ese ISBN."""


class GoogleBooksNoDisponible(BibliotecaError):
    """No se pudo consultar Google Books (falta la API key o falló la conexión)."""


class EjemplarNoEncontrado(BibliotecaError):
    """El ejemplar físico buscado no existe."""


class TransicionEjemplarInvalida(BibliotecaError):
    """El estado actual del ejemplar no admite el cambio pedido (p. ej. reparar uno prestado)."""


class SedeNoPermitida(BibliotecaError):
    """El usuario quiere operar sobre el inventario de una sede que no es la suya."""
