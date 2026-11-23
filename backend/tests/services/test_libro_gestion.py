"""F5 — gestión del catálogo: alta con nombres de autores, edición, baja lógica y proxy de Google Books."""

import pytest

from app.dtos.libro_dto import LibroCreate, LibroUpdate
from app.exceptions.catalogo import (
    GoogleBooksNoDisponible,
    IsbnDuplicado,
    LibroConPrestamosActivos,
    LibroNoEncontrado,
)
from app.models.autor import Autor
from app.models.ejemplar import Ejemplar
from app.models.enums import EstadoEjemplar
from app.models.sede import Sede
from app.repositories.autor_repository import AutorRepository
from app.repositories.libro_repository import LibroRepository
from app.services.libro_service import (
    actualizar_libro,
    buscar_en_google,
    crear_libro,
    dar_de_baja_libro,
)

autor_repo = AutorRepository()
libro_repo = LibroRepository()


def _libro(session, nombre="Rayuela", isbn="9788437604572", autores=("Julio Cortázar",)):
    libro, _ = crear_libro(session, LibroCreate(nombre=nombre, isbn=isbn, autores=list(autores)))
    session.commit()
    return libro


# ------------------------------------------------------------------ alta


def test_crear_libro_con_nombres_de_autores_reutiliza_y_crea(session):
    autor_repo.add(session, Autor(nombre="Julio Cortázar"))
    libro, nuevo = crear_libro(
        session,
        LibroCreate(nombre="Rayuela", isbn="978-84-376-0457-2", autores=["julio cortázar", "Otro Autor"]),
    )
    session.commit()
    assert nuevo is True
    assert libro.isbn == "9788437604572"  # sin guiones
    assert sorted(a.nombre for a in libro.autores) == ["Julio Cortázar", "Otro Autor"]
    assert len(autor_repo.list_todos(session)) == 2  # no duplicó a Cortázar


def test_crear_libro_reactiva_si_el_isbn_estaba_dado_de_baja(session):
    libro = _libro(session)
    dar_de_baja_libro(session, libro.id)
    session.commit()
    otra_vez, nuevo = crear_libro(session, LibroCreate(nombre="Rayuela", isbn="9788437604572"))
    assert nuevo is False
    assert otra_vez.id == libro.id
    assert otra_vez.activo is True


# ------------------------------------------------------------------ edición


def test_actualizar_libro_reemplaza_datos_y_autores(session):
    libro = _libro(session)
    editado = actualizar_libro(
        session,
        libro.id,
        LibroUpdate(nombre="Rayuela (ed. aniversario)", isbn="9788437604572", autores=["Julio Cortázar", "Prologuista"]),
    )
    session.commit()
    assert editado.nombre == "Rayuela (ed. aniversario)"
    assert [a.nombre for a in editado.autores] == ["Julio Cortázar", "Prologuista"]


def test_actualizar_libro_isbn_duplicado(session):
    _libro(session, nombre="Rayuela", isbn="1111111111")
    otro = _libro(session, nombre="Ficciones", isbn="2222222222", autores=())
    with pytest.raises(IsbnDuplicado):
        actualizar_libro(session, otro.id, LibroUpdate(nombre="Ficciones", isbn="1111111111"))


def test_actualizar_libro_inexistente(session):
    with pytest.raises(LibroNoEncontrado):
        actualizar_libro(session, 999, LibroUpdate(nombre="X"))


# ------------------------------------------------------------------ baja lógica


def test_baja_logica_oculta_del_catalogo(session):
    libro = _libro(session)
    dar_de_baja_libro(session, libro.id)
    session.commit()
    assert libro.activo is False
    assert libro_repo.listar_catalogo_filtrado(session) == []
    # no se borra: sigue existiendo con incluir_inactivos
    assert libro_repo.get_by_id(session, libro.id, incluir_inactivos=True) is not None


def test_baja_rechazada_con_ejemplar_prestado(session):
    libro = _libro(session)
    sede = Sede(nombre="Centro", direccion="x")
    session.add(sede)
    session.flush()
    session.add(Ejemplar(codigo_inventario="E1", estado=EstadoEjemplar.PRESTADO,
                         libro_id=libro.id, sede_origen_id=sede.id, sede_actual_id=sede.id))
    session.commit()
    session.expire(libro)
    with pytest.raises(LibroConPrestamosActivos):
        dar_de_baja_libro(session, libro.id)


# ------------------------------------------------------------------ Google Books


def test_buscar_en_google_usa_prefijo_isbn(monkeypatch):
    consultas = []

    def falso_buscar(q, max_results=1):
        consultas.append(q)
        return [{"volumeInfo": {"title": "Rayuela", "authors": ["Julio Cortázar"],
                                "industryIdentifiers": [{"type": "ISBN_13", "identifier": "9788437604572"}]}}]

    monkeypatch.setattr("app.integrations.googlebooks.buscar", falso_buscar)
    resultados = buscar_en_google("978-84-376-0457-2")
    assert consultas == ["isbn:9788437604572"]
    assert resultados[0].nombre == "Rayuela"
    assert resultados[0].autores == ["Julio Cortázar"]

    buscar_en_google("rayuela cortazar")
    assert consultas[-1] == "rayuela cortazar"


def test_buscar_en_google_sin_api_key(monkeypatch):
    def sin_key(q, max_results=1):
        raise RuntimeError("Falta GOOGLE_BOOKS_API_KEY")

    monkeypatch.setattr("app.integrations.googlebooks.buscar", sin_key)
    with pytest.raises(GoogleBooksNoDisponible):
        buscar_en_google("rayuela")
