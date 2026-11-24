"""RemitoRepository: ejemplares de un remito y listados sin N+1.

Para detectar N+1 se cuentan las sentencias SQL que llegan a la base y se compara un
remito con pocos ejemplares contra uno con muchos: con eager loading (selectinload)
la cantidad de queries NO depende de cuántos ejemplares/remitos haya.
"""

from contextlib import contextmanager

from sqlalchemy import event

from app.models.enums import EstadoRemito, MotivoTraslado
from app.models.remito import Remito
from app.repositories.remito_repository import RemitoRepository
from app.services import remito_service

remito_repo = RemitoRepository()


@contextmanager
def contar_queries(session):
    """Cuenta los SELECT/INSERT/... ejecutados dentro del bloque."""
    engine = session.get_bind()
    contador = {"n": 0}

    def _contar(*_args, **_kwargs):
        contador["n"] += 1

    event.listen(engine, "before_cursor_execute", _contar)
    try:
        yield contador
    finally:
        event.remove(engine, "before_cursor_execute", _contar)


def _remito(session, fabrica, n_ejemplares, estado=EstadoRemito.CREADO):
    """Remito Centro→Norte con `n_ejemplares`, cada uno de un libro distinto
    (así acceder a `ejemplar.libro` dispararía una query por ejemplar si hubiera N+1)."""
    centro, norte = fabrica.sede("Centro"), fabrica.sede("Norte")
    biblio = fabrica.usuario(sede=centro)
    ejemplares = [fabrica.ejemplar(fabrica.libro(), centro) for _ in range(n_ejemplares)]
    remito = Remito(
        numero_remito=f"R-TEST-{fabrica._sig()}", motivo_traslado=MotivoTraslado.REBALANCEO,
        estado=estado, sede_origen_id=centro.id, sede_destino_id=norte.id,
        responsable_creacion_id=biblio.id, ejemplares=ejemplares,
    )
    session.add(remito)
    session.flush()
    return remito, ejemplares


def _queries_para_detalle(session, remito_id):
    session.expunge_all()  # vaciar el identity map: que todo se lea de la base
    with contar_queries(session) as c:
        remito = remito_repo.get_con_ejemplares(session, remito_id)
        _ = [(e.codigo_inventario, e.libro.nombre) for e in remito.ejemplares]
        _ = (remito.sede_origen.nombre, remito.sede_destino.nombre)
    return c["n"]


# ----------------------------------------------------------------------- contenido


def test_get_con_ejemplares_trae_los_ejemplares_del_remito(session, fabrica):
    remito, ejemplares = _remito(session, fabrica, 3)
    session.expunge_all()

    encontrado = remito_repo.get_con_ejemplares(session, remito.id)

    assert sorted(e.codigo_inventario for e in encontrado.ejemplares) == sorted(
        e.codigo_inventario for e in ejemplares
    )


def test_get_en_transito_de_ejemplar_ignora_remitos_cerrados(session, fabrica):
    _remito_cerrado, (ej,) = _remito(session, fabrica, 1, estado=EstadoRemito.RECIBIDO)

    assert remito_repo.get_en_transito_de_ejemplar(session, ej.id) is None


def test_historial_de_ejemplar_lista_sus_remitos(session, fabrica):
    remito, (ej,) = _remito(session, fabrica, 1, estado=EstadoRemito.RECIBIDO)

    assert [r.id for r in remito_repo.historial_de_ejemplar(session, ej.id)] == [remito.id]


# --------------------------------------------------------------------------- N+1


def test_detalle_de_remito_sin_n_mas_1(session, fabrica):
    chico, _ = _remito(session, fabrica, 1)
    grande, _ = _remito(session, fabrica, 8)

    assert _queries_para_detalle(session, chico.id) == _queries_para_detalle(session, grande.id)


def test_listado_de_remitos_sin_n_mas_1(session, fabrica):
    """El tablero (listado con `ejemplares_count`) no hace una query por remito."""
    _remito(session, fabrica, 2)
    session.expunge_all()
    with contar_queries(session) as uno:
        assert len(remito_service.listar_pendientes_de_despacho(session)) == 1

    for _ in range(4):
        _remito(session, fabrica, 3)
    session.expunge_all()
    with contar_queries(session) as cinco:
        assert len(remito_service.listar_pendientes_de_despacho(session)) == 5

    assert uno["n"] == cinco["n"]
