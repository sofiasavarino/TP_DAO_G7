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
from app.exceptions.usuario import DatoDuplicado, RolNoConfigurado, SedeInvalida

__all__ = [
    "BibliotecaError",
    "CredencialesInvalidas",
    "DatoDuplicado",
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
    "RolNoConfigurado",
    "SedeInvalida",
    "SocioSancionado",
    "SedeNoPermitida",
    "TransicionEjemplarInvalida",

]
