"""prestamo_service: alta, devolución (inventario flotante) y sanción por retraso."""

from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.dtos.prestamo_dto import PrestamoCreate
from app.exceptions import EjemplarNoDisponible, LimitePrestamosExcedido, SocioSancionado
from app.models.enums import (
    EstadoEjemplar,
    EstadoPrestamo,
    EstadoReserva,
    TipoPrestamo,
    TipoSancion,
)
from app.models.remito import Remito
from app.models.sancion import Sancion
from app.services.prestamo_service import crear_prestamo, devolver_prestamo


def _alta(session, socio, ejemplar):
    return crear_prestamo(
        session,
        PrestamoCreate(socio_id=socio.id, ejemplar_id=ejemplar.id, tipo=TipoPrestamo.LOCAL),
    )


def _sanciones_de(session, prestamo):
    return session.scalars(select(Sancion).where(Sancion.prestamo_id == prestamo.id)).all()


# ------------------------------------------------------------------------- alta


def test_crear_prestamo_pasa_el_ejemplar_a_prestado(session, fabrica):
    sede = fabrica.sede()
    ej = fabrica.ejemplar(fabrica.libro(), sede)

    _alta(session, fabrica.socio(sede), ej)

    assert ej.estado is EstadoEjemplar.PRESTADO


def test_crear_prestamo_nace_activo_con_vencimiento_a_15_dias(session, fabrica):
    sede = fabrica.sede()
    prestamo = _alta(session, fabrica.socio(sede), fabrica.ejemplar(fabrica.libro(), sede))

    assert (prestamo.estado, prestamo.fecha_vencimiento) == (
        EstadoPrestamo.ACTIVO,
        date.today() + timedelta(days=15),
    )


def test_crear_prestamo_rechaza_ejemplar_ya_prestado(session, fabrica):
    sede = fabrica.sede()
    ej = fabrica.ejemplar(fabrica.libro(), sede, EstadoEjemplar.PRESTADO)

    with pytest.raises(EjemplarNoDisponible):
        _alta(session, fabrica.socio(sede), ej)


def test_crear_prestamo_rechaza_socio_sancionado(session, fabrica):
    sede = fabrica.sede()
    socio = fabrica.socio(sede)
    libro = fabrica.libro()
    viejo = fabrica.prestamo(
        socio, fabrica.ejemplar(libro, sede), estado=EstadoPrestamo.FINALIZADO
    )
    session.add(
        Sancion(
            tipo=TipoSancion.MULTA, fecha_inicio=date.today(), motivo="test", monto=5000,
            socio_id=socio.id, prestamo_id=viejo.id,
        )
    )
    session.flush()

    with pytest.raises(SocioSancionado):
        _alta(session, socio, fabrica.ejemplar(libro, sede))


def test_crear_prestamo_respeta_limite_de_prestamos_abiertos(session, fabrica):
    sede = fabrica.sede()
    socio = fabrica.socio(sede)
    libro = fabrica.libro()
    for _ in range(2):  # MAX_PRESTAMOS_ABIERTOS
        _alta(session, socio, fabrica.ejemplar(libro, sede))

    with pytest.raises(LimitePrestamosExcedido):
        _alta(session, socio, fabrica.ejemplar(libro, sede))


# -------------------------------------------------------------------- devolución


def test_devolver_finaliza_el_prestamo(session, fabrica):
    sede = fabrica.sede()
    biblio = fabrica.usuario(sede=sede)
    prestamo = _alta(session, fabrica.socio(sede), fabrica.ejemplar(fabrica.libro(), sede))

    devolver_prestamo(session, prestamo.id, sede_id=sede.id, usuario_id=biblio.id)

    assert prestamo.estado is EstadoPrestamo.FINALIZADO


def test_devolver_en_otra_sede_actualiza_sede_actual(session, fabrica):
    """Colección flotante: el ejemplar se queda donde lo devolvieron."""
    centro, norte = fabrica.sede("Centro"), fabrica.sede("Norte")
    biblio = fabrica.usuario(sede=norte)
    ej = fabrica.ejemplar(fabrica.libro(), centro)
    prestamo = _alta(session, fabrica.socio(centro), ej)

    devolver_prestamo(session, prestamo.id, sede_id=norte.id, usuario_id=biblio.id)

    assert (ej.sede_actual_id, ej.estado) == (norte.id, EstadoEjemplar.DISPONIBLE)


def test_devolver_a_tiempo_no_crea_sancion(session, fabrica):
    sede = fabrica.sede()
    biblio = fabrica.usuario(sede=sede)
    prestamo = _alta(session, fabrica.socio(sede), fabrica.ejemplar(fabrica.libro(), sede))

    devolver_prestamo(session, prestamo.id, sede_id=sede.id, usuario_id=biblio.id)

    assert _sanciones_de(session, prestamo) == []


def test_devolver_tarde_crea_sancion_multa(session, fabrica):
    sede = fabrica.sede()
    biblio = fabrica.usuario(sede=sede)
    ej = fabrica.ejemplar(fabrica.libro(), sede, EstadoEjemplar.PRESTADO)
    # 10 días corridos de atraso garantizan al menos 6 días hábiles, caiga el día que caiga.
    prestamo = fabrica.prestamo(
        fabrica.socio(sede), ej, fecha_vencimiento=date.today() - timedelta(days=10)
    )

    devolver_prestamo(session, prestamo.id, sede_id=sede.id, usuario_id=biblio.id)

    assert [s.tipo for s in _sanciones_de(session, prestamo)] == [TipoSancion.MULTA]


def test_devolver_con_danios_va_a_reparacion_y_suspende(session, fabrica):
    sede = fabrica.sede()
    biblio = fabrica.usuario(sede=sede)
    ej = fabrica.ejemplar(fabrica.libro(), sede)
    prestamo = _alta(session, fabrica.socio(sede), ej)

    devolver_prestamo(session, prestamo.id, sede_id=sede.id, usuario_id=biblio.id, con_danios=True)

    assert (ej.estado, [s.tipo for s in _sanciones_de(session, prestamo)]) == (
        EstadoEjemplar.EN_REPARACION,
        [TipoSancion.SUSPENSION],
    )


def test_devolver_dos_veces_falla(session, fabrica):
    sede = fabrica.sede()
    biblio = fabrica.usuario(sede=sede)
    prestamo = _alta(session, fabrica.socio(sede), fabrica.ejemplar(fabrica.libro(), sede))
    devolver_prestamo(session, prestamo.id, sede_id=sede.id, usuario_id=biblio.id)

    with pytest.raises(ValueError, match="ya devuelto"):
        devolver_prestamo(session, prestamo.id, sede_id=sede.id, usuario_id=biblio.id)


def test_devolver_con_reserva_en_otra_sede_encola_remito(session, fabrica):
    """La reserva más vieja se retira en otra sede: el ejemplar queda RESERVADO
    y viaja en un remito CREADO hacia esa sede."""
    centro, norte = fabrica.sede("Centro"), fabrica.sede("Norte")
    biblio = fabrica.usuario(sede=centro)
    libro = fabrica.libro()
    ej = fabrica.ejemplar(libro, centro)
    prestamo = _alta(session, fabrica.socio(centro), ej)
    reserva = fabrica.reserva(fabrica.socio(norte), libro, norte)

    devolver_prestamo(session, prestamo.id, sede_id=centro.id, usuario_id=biblio.id)

    remito = session.scalars(select(Remito)).one()
    assert (ej.estado, reserva.estado, reserva.ejemplar_id, remito.sede_destino_id) == (
        EstadoEjemplar.RESERVADO,
        EstadoReserva.PENDIENTE,
        ej.id,
        norte.id,
    )
