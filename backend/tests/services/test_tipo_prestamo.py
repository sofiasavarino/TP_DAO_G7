"""El tipo de préstamo lo decide el backend: directo = LOCAL; reserva = según remito."""

from datetime import date, timedelta

from app.dtos.prestamo_dto import PrestamoCreate
from app.models.ejemplar import Ejemplar
from app.models.enums import (
    EstadoEjemplar,
    EstadoPrestamo,
    EstadoRemito,
    EstadoReserva,
    EstadoSocio,
    MotivoTraslado,
    TipoPrestamo,
)
from app.models.libro import Libro
from app.models.remito import Remito
from app.models.reserva import Reserva
from app.models.rol import Rol
from app.models.sede import Sede
from app.models.socio import Socio
from app.models.usuario import Usuario
from app.services.prestamo_service import crear_prestamo, crear_prestamo_para_reserva

HOY = date.today()


def _contexto(session, estado_ejemplar=EstadoEjemplar.DISPONIBLE, originaria="Norte"):
    centro = Sede(nombre="Centro", direccion="Calle 1")
    norte = Sede(nombre="Norte", direccion="Calle 2")
    session.add_all([centro, norte])
    session.flush()

    rol = Rol(nombre="Socio", descripcion="socio de prueba")
    session.add(rol)
    session.flush()
    usuario = Usuario(
        nombre_usuario="socio_tipo", email="tipo@test.com", hash="x",
        rol_id=rol.id, sede_id=centro.id,
    )
    session.add(usuario)
    session.flush()
    socio = Socio(
        nombre="Ana", apellido="Pérez", dni="22222222",
        estado=EstadoSocio.ACTIVO, usuario_id=usuario.id,
    )
    session.add(socio)
    libro = Libro(nombre="Libro de tipo")
    session.add(libro)
    session.flush()

    ejemplar = Ejemplar(
        codigo_inventario="E-TIPO", estado=estado_ejemplar, libro_id=libro.id,
        sede_origen_id=norte.id if originaria == "Norte" else centro.id,
        sede_actual_id=centro.id,
    )
    session.add(ejemplar)
    session.flush()
    return socio, libro, centro, norte, usuario, ejemplar


def _remito(session, usuario, ejemplar, origen, destino, motivo=MotivoTraslado.IDA, recepcion=None):
    session.add(
        Remito(
            numero_remito=f"R-TIPO-{recepcion or 'x'}-{motivo.value}",
            motivo_traslado=motivo,
            estado=EstadoRemito.RECIBIDO,
            sede_origen_id=origen.id, sede_destino_id=destino.id,
            responsable_creacion_id=usuario.id,
            responsable_despacho_id=usuario.id, responsable_recepcion_id=usuario.id,
            fecha_despacho=recepcion or HOY, fecha_recepcion=recepcion or HOY,
            ejemplares=[ejemplar],
        )
    )
    session.flush()


def _reserva(session, socio, libro, centro, ejemplar, fecha=None):
    reserva = Reserva(
        socio_id=socio.id, libro_id=libro.id, sede_retiro_id=centro.id,
        ejemplar_id=ejemplar.id, estado=EstadoReserva.LISTA_PARA_RETIRO,
        fecha_reserva=fecha or HOY,
    )
    session.add(reserva)
    session.flush()
    return reserva


def test_prestamo_directo_es_local_aunque_el_ejemplar_viniera_de_otra_sede(session):
    socio, _libro, centro, norte, usuario, ejemplar = _contexto(session)
    # History real de remito + sede_origen distinta: antes se sugería INTERBIBLIOTECARIO.
    _remito(session, usuario, ejemplar, norte, centro)

    prestamo = crear_prestamo(session, PrestamoCreate(socio_id=socio.id, ejemplar_id=ejemplar.id))
    assert prestamo.tipo == TipoPrestamo.LOCAL


def test_reserva_servida_por_remito_es_interbibliotecaria(session):
    socio, libro, centro, norte, usuario, ejemplar = _contexto(
        session, estado_ejemplar=EstadoEjemplar.RESERVADO
    )
    _remito(session, usuario, ejemplar, norte, centro)
    reserva = _reserva(session, socio, libro, centro, ejemplar)

    prestamo = crear_prestamo_para_reserva(session, reserva)
    assert prestamo.tipo == TipoPrestamo.INTERBIBLIOTECARIO


def test_reserva_con_ejemplar_local_es_local(session):
    socio, libro, centro, _norte, _usuario, ejemplar = _contexto(
        session, estado_ejemplar=EstadoEjemplar.RESERVADO, originaria="Centro"
    )
    reserva = _reserva(session, socio, libro, centro, ejemplar)

    prestamo = crear_prestamo_para_reserva(session, reserva)
    assert prestamo.tipo == TipoPrestamo.LOCAL


def test_remito_anterior_a_la_reserva_no_cuenta(session):
    socio, libro, centro, norte, usuario, ejemplar = _contexto(
        session, estado_ejemplar=EstadoEjemplar.RESERVADO
    )
    _remito(session, usuario, ejemplar, norte, centro, recepcion=HOY - timedelta(days=30))
    reserva = _reserva(session, socio, libro, centro, ejemplar)

    prestamo = crear_prestamo_para_reserva(session, reserva)
    assert prestamo.tipo == TipoPrestamo.LOCAL


def test_rebalanceo_no_cuenta_como_interbibliotecario(session):
    socio, libro, centro, norte, usuario, ejemplar = _contexto(
        session, estado_ejemplar=EstadoEjemplar.RESERVADO
    )
    _remito(session, usuario, ejemplar, norte, centro, motivo=MotivoTraslado.REBALANCEO)
    reserva = _reserva(session, socio, libro, centro, ejemplar)

    prestamo = crear_prestamo_para_reserva(session, reserva)
    assert prestamo.tipo == TipoPrestamo.LOCAL
    assert prestamo.estado == EstadoPrestamo.ACTIVO
