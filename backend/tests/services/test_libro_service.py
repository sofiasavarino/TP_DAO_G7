from datetime import date

import pytest

from app.dtos.libro_dto import LibroCreate
from app.models.autor import Autor
from app.models.enums import EstadoEjemplar
from app.models.ejemplar import Ejemplar
from app.models.libro import Libro
from app.repositories.autor_repository import AutorRepository
from app.repositories.libro_repository import LibroRepository
from app.services.libro_service import crear_libro

autor_repo = AutorRepository()
libro_repo = LibroRepository()


def test_crear_libro_manual_ok(session):
    datos = LibroCreate(nombre="Cien años de soledad", isbn="0307472201", cant_paginas=417)
    libro, es_nuevo = crear_libro(session, datos)
    session.commit()
    assert es_nuevo is True
    assert libro.id is not None
    assert libro.nombre == "Cien años de soledad"


def test_crear_libro_dedupa_por_isbn(session):
    datos = LibroCreate(nombre="Cien años de soledad", isbn="0307472201", cant_paginas=417)
    libro1, _ = crear_libro(session, datos)
    datos2 = LibroCreate(nombre="Cien años de soledad (edicion nueva)", isbn="0307472201", cant_paginas=417)
    libro2, es_nuevo = crear_libro(session, datos2)
    assert es_nuevo is False
    assert libro1.id == libro2.id
    assert libro_repo.existe_isbn(session, "0307472201") is True


def test_crear_libro_con_autores_validos(session):
    autor = autor_repo.add(session, Autor(nombre="García Márquez"))
    datos = LibroCreate(
        nombre="Ficciones", isbn="0000000004", cant_paginas=250, autor_ids=[autor.id]
    )
    libro, es_nuevo = crear_libro(session, datos)
    session.commit()
    assert es_nuevo is True
    assert [a.nombre for a in libro.autores] == ["García Márquez"]


def test_crear_libro_con_autor_inexistente_falla(session):
    datos = LibroCreate(
        nombre="Ficciones", isbn="0000000004", cant_paginas=250, autor_ids=[9999]
    )
    with pytest.raises(ValueError, match="autores no encontrados"):
        crear_libro(session, datos)


def test_crear_libro_sin_isbn(session):
    datos = LibroCreate(nombre="Sin ISBN", cant_paginas=100)
    libro, _ = crear_libro(session, datos)
    assert libro.isbn is None
