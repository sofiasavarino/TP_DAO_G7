"""Tests de cálculo de los reportes (porcentajes y tasas sobre agregados)."""

from datetime import date

import pytest

from app.models.ejemplar import Ejemplar
from app.models.enums import (
    EstadoEjemplar,
    EstadoPrestamo,
    EstadoRemito,
    EstadoReserva,
    MotivoTraslado,
    TipoPrestamo,
    TipoSancion,
)
from app.models.libro import Libro
from app.models.prestamo import Prestamo
from app.models.remito import Remito
from app.models.reserva import Reserva
from app.models.rol import Rol
from app.models.sancion import Sancion
from app.models.sede import Sede
from app.models.socio import Socio
from app.models.usuario import Usuario
from app.reports.service import (
    carga_operativa_por_sede,
    cumplimiento_retiro,
    disponibilidad_por_sede,
    eficacia_logistica,
    multas_acumuladas,
    presion_por_libro,
    salud_coleccion,
    uso_por_genero_sede,
    vencidos_sin_sancion,
)


def _base(session):
    s1 = Sede(nombre="Centro", direccion="Calle 1")
    s2 = Sede(nombre="Norte", direccion="Calle 2")
    session.add_all([s1, s2])
    session.flush()
    rol = Rol(nombre="Socio", descripcion="test")
    session.add(rol)
    session.flush()
    u = Usuario(
        nombre_usuario="u_test", email="u@test.com", hash="x",
        rol_id=rol.id, sede_id=s1.id,
    )
    session.add(u)
    session.flush()
    socio = Socio(
        nombre="Ana", apellido="P", dni="12345678", usuario_id=u.id,
    )
    session.add(socio)
    libro = Libro(nombre="Libro")
    session.add(libro)
    session.flush()
    return s1, s2, u, socio, libro


def _ej(session, libro, sede, codigo, estado=EstadoEjemplar.DISPONIBLE):
    ej = Ejemplar(
        codigo_inventario=codigo, estado=estado, libro_id=libro.id,
        sede_origen_id=sede.id, sede_actual_id=sede.id,
    )
    session.add(ej)
    session.flush()
    return ej


def test_disponibilidad_por_sede_porcentajes(session):
    s1, s2, _u, _socio, libro = _base(session)
    _ej(session, libro, s1, "E1", EstadoEjemplar.DISPONIBLE)
    _ej(session, libro, s1, "E2", EstadoEjemplar.PRESTADO)
    _ej(session, libro, s2, "E3", EstadoEjemplar.INUTILIZABLE)  # se excluye del total

    filas = {f.sede: f for f in disponibilidad_por_sede(session)}
    assert filas["Centro"].total == 2
    assert filas["Centro"].disponibles == 1
    assert filas["Centro"].porcentaje == 50.0
    assert "Norte" not in filas  # su único ejemplar es INUTILIZABLE


def test_eficacia_logistica_tasa(session):
    s1, s2, u, _socio, _libro = _base(session)
    for i, estado in enumerate(
        [EstadoRemito.RECIBIDO, EstadoRemito.RECIBIDO, EstadoRemito.CON_INCIDENCIA]
    ):
        session.add(
            Remito(
                numero_remito=f"R-{i}", motivo_traslado=MotivoTraslado.REBALANCEO,
                estado=estado, sede_origen_id=s1.id, sede_destino_id=s2.id,
                responsable_creacion_id=u.id,
            )
        )
    session.flush()

    r = eficacia_logistica(session)
    assert r.recibidos == 2
    assert r.con_incidencia == 1
    assert r.finalizados == 3
    assert r.tasa_exito_porcentaje == 66.67


def test_salud_coleccion_porcentajes(session):
    s1, _s2, _u, _socio, libro = _base(session)
    _ej(session, libro, s1, "E1", EstadoEjemplar.DISPONIBLE)
    _ej(session, libro, s1, "E2", EstadoEjemplar.EN_REPARACION)

    filas = {f.estado: f for f in salud_coleccion(session)}
    assert filas["DISPONIBLE"].porcentaje == 50.0
    assert filas["EN_REPARACION"].porcentaje == 50.0
    assert sum(f.porcentaje for f in filas.values()) == 100.0


def test_cumplimiento_retiro_tasa(session):
    s1, _s2, _u, socio, libro = _base(session)
    for estado in (
        EstadoReserva.CUMPLIDA,
        EstadoReserva.CUMPLIDA,
        EstadoReserva.VENCIDA,
    ):
        session.add(
            Reserva(
                fecha_reserva=date(2026, 11, 1), estado=estado,
                socio_id=socio.id, libro_id=libro.id, sede_retiro_id=s1.id,
            )
        )
    session.flush()

    r = cumplimiento_retiro(session)
    assert r.cumplidas == 2
    assert r.vencidas == 1
    assert r.tasa_cumplimiento_porcentaje == 66.67


def _prestamo(session, socio, ej, estado=EstadoPrestamo.ACTIVO, numero="P-T"):
    p = Prestamo(
        numero=numero, tipo=TipoPrestamo.LOCAL, estado=estado,
        fecha_inicio=date(2026, 11, 1), fecha_vencimiento=date(2026, 11, 20),
        socio_id=socio.id, ejemplar_id=ej.id,
    )
    session.add(p)
    session.flush()
    return p


def test_carga_operativa_y_uso_por_genero(session):
    s1, s2, u, socio, libro = _base(session)
    libro.genero = "Ficción"
    ej1 = _ej(session, libro, s1, "E1")
    _ej(session, libro, s2, "E2")
    _prestamo(session, socio, ej1)
    session.add(
        Remito(
            numero_remito="R-TRANS", motivo_traslado=MotivoTraslado.REBALANCEO,
            estado=EstadoRemito.EN_TRANSITO, sede_origen_id=s1.id, sede_destino_id=s2.id,
            responsable_creacion_id=u.id, ejemplares=[ej1],
        )
    )
    session.flush()

    carga = {c.sede: c for c in carga_operativa_por_sede(session)}
    assert carga["Centro"].prestamos_activos == 1
    assert carga["Norte"].remitos_en_transito == 1
    assert carga["Norte"].ejemplares_en_transito == 1

    uso = uso_por_genero_sede(session)
    assert uso[0].genero == "Ficción"
    assert uso[0].prestamos == 1


def test_multas_y_vencidos_sin_sancion(session):
    s1, _s2, _u, socio, libro = _base(session)
    ej = _ej(session, libro, s1, "E1")
    activo = _prestamo(session, socio, ej, EstadoPrestamo.ACTIVO, "P-OK")
    vencido = _prestamo(session, socio, ej, EstadoPrestamo.VENCIDO, "P-VENCE")
    session.add(
        Sancion(
            tipo=TipoSancion.MULTA, fecha_inicio=date(2026, 11, 21), motivo="prueba",
            monto=5000, socio_id=socio.id, prestamo_id=activo.id,
        )
    )
    session.flush()

    multas = multas_acumuladas(session)
    assert multas.total == 5000
    assert multas.socios[0].cantidad == 1

    sin_sancion = vencidos_sin_sancion(session)
    assert sin_sancion.cantidad == 1
    assert sin_sancion.prestamos[0].numero == "P-VENCE"


def test_presion_por_libro_ratio(session):
    s1, _s2, _u, socio, libro = _base(session)
    _ej(session, libro, s1, "E1")
    for _ in range(3):
        session.add(
            Reserva(
                fecha_reserva=date(2026, 11, 1), estado=EstadoReserva.PENDIENTE,
                socio_id=socio.id, libro_id=libro.id, sede_retiro_id=s1.id,
            )
        )
    session.flush()

    filas = presion_por_libro(session)
    assert filas[0].reservas_esperando == 3
    assert filas[0].ejemplares == 1
    assert filas[0].ratio == 3.0
