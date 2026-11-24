"""Consultas de disponibilidad: qué ejemplares/libros se pueden ofrecer hoy.

(Las búsquedas de texto del catálogo están en `test_libro_repository.py`.)
"""

from app.models.enums import EstadoEjemplar
from app.repositories.ejemplar_repository import EjemplarRepository
from app.repositories.libro_repository import LibroRepository

ejemplar_repo = EjemplarRepository()
libro_repo = LibroRepository()


def _escenario(fabrica):
    """Un libro con: 1 DISPONIBLE en Centro, 1 PRESTADO en Centro, 1 DISPONIBLE en Norte."""
    centro, norte = fabrica.sede("Centro"), fabrica.sede("Norte")
    libro = fabrica.libro("Rayuela")
    fabrica.ejemplar(libro, centro, EstadoEjemplar.DISPONIBLE)
    fabrica.ejemplar(libro, centro, EstadoEjemplar.PRESTADO)
    fabrica.ejemplar(libro, norte, EstadoEjemplar.DISPONIBLE)
    return centro, norte, libro


def test_listar_disponibles_excluye_no_disponibles(session, fabrica):
    _centro, _norte, libro = _escenario(fabrica)

    disponibles = ejemplar_repo.listar_disponibles(session, libro_id=libro.id)

    assert [e.estado for e in disponibles] == [EstadoEjemplar.DISPONIBLE] * 2


def test_listar_disponibles_filtra_por_sede_actual(session, fabrica):
    centro, _norte, libro = _escenario(fabrica)

    disponibles = ejemplar_repo.listar_disponibles(session, libro_id=libro.id, sede_id=centro.id)

    assert [e.sede_actual_id for e in disponibles] == [centro.id]


def test_listar_disponibles_filtra_por_libro(session, fabrica):
    centro, _norte, _libro = _escenario(fabrica)
    otro = fabrica.libro("Ficciones")
    fabrica.ejemplar(otro, centro)

    disponibles = ejemplar_repo.listar_disponibles(session, libro_id=otro.id)

    assert [e.libro_id for e in disponibles] == [otro.id]


def test_primer_disponible_none_si_todos_prestados(session, fabrica):
    sede = fabrica.sede()
    libro = fabrica.libro()
    fabrica.ejemplar(libro, sede, EstadoEjemplar.PRESTADO)

    assert ejemplar_repo.primer_disponible(session, libro.id) is None


def test_catalogo_por_sede_ignora_libros_sin_copias_disponibles(session, fabrica):
    sede = fabrica.sede()
    con_stock = fabrica.libro("Con stock")
    sin_stock = fabrica.libro("Sin stock")
    fabrica.ejemplar(con_stock, sede, EstadoEjemplar.DISPONIBLE)
    fabrica.ejemplar(sin_stock, sede, EstadoEjemplar.PRESTADO)

    libros = libro_repo.listar_catalogo_filtrado(session, sedes=[sede.id])

    assert [l.nombre for l in libros] == ["Con stock"]
