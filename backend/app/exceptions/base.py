class BibliotecaError(Exception):
    """Error base del dominio de la biblioteca.

    Permite capturar cualquier error de negocio con un único `except`.
    Cada subclase representa una regla particular que fue violada.
    """
