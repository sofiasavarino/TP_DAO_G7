from app.exceptions.base import BibliotecaError


class DatoDuplicado(BibliotecaError):
    """Ya existe un registro con ese valor único (usuario, DNI, email o legajo).

    `campo` indica cuál chocó, para que la vista lo marque en el formulario.
    """

    def __init__(self, campo: str, mensaje: str) -> None:
        super().__init__(mensaje)
        self.campo = campo


class SedeInvalida(BibliotecaError):
    """La sede elegida no existe o está dada de baja."""


class RolNoConfigurado(BibliotecaError):
    """Falta el rol en la base (no se corrieron los seeds)."""
