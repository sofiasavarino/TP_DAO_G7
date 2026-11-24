"""Un remito no acepta RESERVADOS al crearlo/agregarlos; el despacho sí los tolera."""

from datetime import date

import pytest

from app.dtos.remito_dto import RemitoCreate
from app.models.ejemplar import Ejemplar
from app.models.enums import EstadoEjemplar, EstadoRemito, MotivoTraslado
from app.models.libro import Libro
from app.models.rol import Rol
from app.models.sede import Sede
from app.models.usuario import Usuario
from app.services.remito_service import agregar_ejemplares, crear_remito, despachar


def _contexto(session):
    s1 = Sede(nombre="Centro", direccion="Calle 1")
    s2 = Sede(nombre="Norte", direccion="Calle 2")
    session.add_all([s1, s2])
    session.flush()
    rol = Rol(nombre="Bibliotecario", descripcion="test")
    session.add(rol)
    session.flush()
    u = Usuario(
        nombre_usuario="biblio", email="b@test.com", hash="x",
        rol_id=rol.id, sede_id=s1.id,
    )
    session.add(u)
    libro = Libro(nombre="Libro")
    session.add(libro)
    session.flush()
    return s1, s2, u, libro


def _ej(session, libro, sede, codigo, estado=EstadoEjemplar.DISPONIBLE):
    ej = Ejemplar(
        codigo_inventario=codigo, estado=estado, libro_id=libro.id,
        sede_origen_id=sede.id, sede_actual_id=sede.id,
    )
    session.add(ej)
    session.flush()
    return ej


def _datos(s1, s2, ids, numero):
    return RemitoCreate(
        numero_remito=numero, motivo_traslado=MotivoTraslado.REBALANCEO,
        sede_origen_id=s1.id, sede_destino_id=s2.id, ejemplar_ids=ids,
    )


def test_crear_remito_rechaza_ejemplar_reservado(session):
    s1, s2, u, libro = _contexto(session)
    reservado = _ej(session, libro, s1, "E-RES", EstadoEjemplar.RESERVADO)

    with pytest.raises(ValueError, match="está RESERVADO"):
        crear_remito(session, _datos(s1, s2, [reservado.id], "R-RES"), u.id)


def test_agregar_ejemplares_rechaza_reservado(session):
    s1, s2, u, libro = _contexto(session)
    libre = _ej(session, libro, s1, "E-LIBRE")
    reservado = _ej(session, libro, s1, "E-RES", EstadoEjemplar.RESERVADO)
    remito = crear_remito(session, _datos(s1, s2, [libre.id], "R-OK"), u.id)

    with pytest.raises(ValueError, match="está RESERVADO"):
        agregar_ejemplares(session, remito.id, [reservado.id])


def test_despacho_acepta_reservado_del_flujo_automatico(session):
    s1, s2, u, libro = _contexto(session)
    ej = _ej(session, libro, s1, "E-AUTO")
    remito = crear_remito(session, _datos(s1, s2, [ej.id], "R-AUTO"), u.id)
    # El flujo automático encola en DISPONIBLE y recién después lo marca RESERVADO.
    ej.estado = EstadoEjemplar.RESERVADO

    despachado = despachar(session, remito.id, u.id)
    assert despachado.estado is EstadoRemito.EN_TRANSITO
    assert ej.estado is EstadoEjemplar.EN_TRANSITO
