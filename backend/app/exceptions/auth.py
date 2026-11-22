from app.exceptions.base import BibliotecaError


class CredencialesInvalidas(BibliotecaError):
    """Usuario inexistente, dado de baja o contraseña incorrecta.

    Es la misma excepción para los tres casos a propósito: así el login no revela
    si un nombre de usuario existe.
    """