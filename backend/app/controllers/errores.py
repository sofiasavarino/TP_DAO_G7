"""Traducción de excepciones de dominio a respuestas HTTP para las altas de cuentas."""

from fastapi import HTTPException, status

from app.exceptions.base import BibliotecaError
from app.exceptions.usuario import DatoDuplicado, RolNoConfigurado, SedeInvalida


def error_de_alta(e: BibliotecaError) -> HTTPException:
    """409 por duplicados (con el campo que chocó), 400 por sede inválida, 500 si faltan seeds."""
    if isinstance(e, DatoDuplicado):
        return HTTPException(
            status.HTTP_409_CONFLICT, detail={"campo": e.campo, "mensaje": str(e)}
        )
    if isinstance(e, SedeInvalida):
        return HTTPException(
            status.HTTP_400_BAD_REQUEST, detail={"campo": "sede_id", "mensaje": str(e)}
        )
    if isinstance(e, RolNoConfigurado):
        return HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    return HTTPException(status.HTTP_409_CONFLICT, detail=str(e))
