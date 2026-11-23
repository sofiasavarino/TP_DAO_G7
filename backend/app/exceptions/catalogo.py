from app.exceptions.base import BibliotecaError


class LibroNoEncontrado(BibliotecaError):
    """El libro buscado por id/ISBN/título no existe."""


class LibroConPrestamosActivos(BibliotecaError):
    """No se puede inhabilitar/eliminar del catálogo un libro que tiene préstamos abiertos."""


class IsbnDuplicado(BibliotecaError):
    """Ya hay otro libro del catálogo con ese ISBN."""


class GoogleBooksNoDisponible(BibliotecaError):
    """No se pudo consultar Google Books (falta la API key o falló la conexión)."""
