"""Un ejemplar agregado a un remito abierto no puede reservarse ni prestarse."""

import pytest

from app.dtos.prestamo_dto import PrestamoCreate
from app.exceptions import EjemplarNoDisponible
from app.models.ejemplar import Ejemplar
from app.models.enums import (
    EstadoEjemplar,
    EstadoRemito,
    EstadoSocio,
    MotivoTraslado,
    TipoPrestamo,
)
from app.models.libro import Libro
from app.models.remito import Remito
from app.models.rol import Rol
from app.models.sede import Sede
from app.models.socio import Socio
from app.models.usuario import Usuario
from app.repositories.ejemplar_repository import EjemplarRepository
from app.services.prestamo_service import crear_prestamo

ejemplar_repo = EjemplarRepository()


def _contexto(session, con_segundo_libre=False):
    sede1 = Sede(nombre="Centro", direccion="Calle 1")
    sede2 = Sede(nombre="Norte", direccion="Calle 2")
    session.add_all([sede1, sede2])
    session.flush()

    rol = Rol(nombre="Socio", descripcion="socio de prueba")
    session.add(rol)
    session.flush()

    usuario = Usuario(
        nombre_usuario="socio_test", email="socio@test.com", hash="x",
        rol_id=rol.id, sede_id=sede1.id,
    )
    session.add(usuario)
    session.flush()

    socio = Socio(
        nombre="Ana", apellido="Pérez", dni="11111111",
        estado=EstadoSocio.ACTIVO, usuario_id=usuario.id,
    )
    session.add(socio)

    libro = Libro(nombre="Libro de prueba")
    session.add(libro)
    session.flush()

    ej1 = Ejemplar(
        codigo_inventario="E-REMITO", estado=EstadoEjemplar.DISPONIBLE,
        libro_id=libro.id, sede_origen_id=sede1.id, sede_actual_id=sede1.id,
    )
    session.add(ej1)
    session.flush()

    remito = Remito(
        numero_remito="R-TEST", motivo_traslado=MotivoTraslado.REBALANCEO,
        estado=EstadoRemito.CREADO, sede_origen_id=sede1.id, sede_destino_id=sede2.id,
        responsable_creacion_id=usuario.id, ejemplares=[ej1],
    )
    session.add(remito)

    if con_segundo_libre:
        session.add(
            Ejemplar(
                codigo_inventario="E-LIBRE", estado=EstadoEjemplar.DISPONIBLE,
                libro_id=libro.id, sede_origen_id=sede1.id, sede_actual_id=sede1.id,
            )
        )
    session.flush()
    return socio, libro, ej1


def test_primer_disponible_excluye_ejemplar_en_remito(session):
    _socio, libro, _ej = _contexto(session)
    assert ejemplar_repo.primer_disponible(session, libro.id) is None


def test_primer_disponible_devuelve_otro_si_no_esta_en_remito(session):
    _socio, libro, _ej = _contexto(session, con_segundo_libre=True)
    encontrado = ejemplar_repo.primer_disponible(session, libro.id)
    assert encontrado is not None
    assert encontrado.codigo_inventario == "E-LIBRE"


def test_crear_prestamo_rechaza_ejemplar_comprometido_en_remito(session):
    socio, _libro, ej = _contexto(session)
    with pytest.raises(EjemplarNoDisponible, match="comprometido en un remito"):
        crear_prestamo(
            session,
            PrestamoCreate(socio_id=socio.id, ejemplar_id=ej.id, tipo=TipoPrestamo.LOCAL),
        )
