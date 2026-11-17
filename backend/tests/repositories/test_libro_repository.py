from app.models.autor import Autor
from app.models.libro import Libro
from app.repositories.autor_repository import AutorRepository
from app.repositories.libro_repository import LibroRepository

autor_repo = AutorRepository()
libro_repo = LibroRepository()


def _hacer_libro(session, nombre="Cien años de soledad", isbn="0307472201"):
    libro = Libro(nombre=nombre, isbn=isbn, cant_paginas=417)
    session.add(libro)
    session.flush()
    return libro


def test_crear_y_get_by_isbn(session):
    libro = _hacer_libro(session)
    encontrado = libro_repo.get_by_isbn(session, "0307472201")
    assert encontrado is not None
    assert encontrado.id == libro.id


def test_guardar_y_existe_isbn(session):
    _hacer_libro(session)
    assert libro_repo.existe_isbn(session, "0307472201") is True
    assert libro_repo.existe_isbn(session, "0000000000") is False


def test_listar_catalogo_ordenado_por_nombre(session):
    _hacer_libro(session, nombre="Zeta", isbn="0000000001")
    _hacer_libro(session, nombre="Alfa", isbn="0000000002")
    libros = libro_repo.listar_catalogo(session)
    assert [l.nombre for l in libros] == ["Alfa", "Zeta"]


def test_buscar_por_titulo(session):
    _hacer_libro(session, nombre="Cien años de soledad", isbn="0000000003")
    assert len(libro_repo.buscar_por_titulo(session, "cien")) == 1
    assert len(libro_repo.buscar_por_titulo(session, "soledad")) == 1
    assert len(libro_repo.buscar_por_titulo(session, "inexistente")) == 0


def test_buscar_por_autor(session):
    autor = autor_repo.add(session, Autor(nombre="García Márquez"))
    libro = _hacer_libro(session, nombre="Ficciones", isbn="0000000004")
    libro.autores.append(autor)
    session.flush()
    assert len(libro_repo.buscar_por_autor(session, "garc")) == 1  # subcadena, sin depender de tildes
