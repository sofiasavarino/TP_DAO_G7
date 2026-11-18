from app.exceptions.base import BibliotecaError


class RemitoNoEncontrado(BibliotecaError):
    """El remito buscado por id o número no existe."""
