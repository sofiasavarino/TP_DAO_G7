from app.exceptions.base import BibliotecaError


class LibroNoEncontrado(BibliotecaError):
    """El libro buscado por id/ISBN/título no existe."""


class LibroConPrestamosActivos(BibliotecaError):
    """No se puede inhabilitar/eliminar del catálogo un libro que tiene préstamos abiertos."""
