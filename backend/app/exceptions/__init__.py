"""Excepciones de dominio de la biblioteca.

Juntas todas las importa y exportadas para conveniencia:

    from app import exceptions

    raise exceptions.SocioSancionado(...)
"""
from app.exceptions.auth import CredencialesInvalidas
from app.exceptions.base import BibliotecaError
from app.exceptions.catalogo import (
    EjemplarNoEncontrado,
    GoogleBooksNoDisponible,
    IsbnDuplicado,
    LibroConPrestamosActivos,
    LibroNoEncontrado,
    SedeNoPermitida,
    TransicionEjemplarInvalida,
)
from app.exceptions.prestamo import (
    EjemplarNoDisponible,
    LimitePrestamosExcedido,
    SocioSancionado,
)
from app.exceptions.remito import RemitoNoEncontrado
from app.exceptions.reserva import EjemplarNoDisponibleParaAsignar, ReservaNoEncontrada

__all__ = [
    "BibliotecaError",
    "CredencialesInvalidas"
    "EjemplarNoDisponible",
    "EjemplarNoDisponibleParaAsignar",
    "EjemplarNoEncontrado",
    "GoogleBooksNoDisponible",
    "IsbnDuplicado",
    "LibroConPrestamosActivos",
    "LibroNoEncontrado",
    "LimitePrestamosExcedido",
    "RemitoNoEncontrado",
    "ReservaNoEncontrada",
    "SedeNoPermitida",
    "SocioSancionado",
    "TransicionEjemplarInvalida",

]
