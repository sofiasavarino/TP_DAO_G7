from app.models.autor import Autor
from app.models.ejemplar import Ejemplar
from app.models.enums import EstadoEjemplar
from app.models.libro import Libro
from app.models.sede import Sede
from app.repositories.autor_repository import AutorRepository
from app.repositories.libro_repository import LibroRepository
from app.services.libro_service import to_listado_dto

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


def test_listar_catalogo_filtrado_texto(session):
    _hacer_libro(session, nombre="Rayuela", isbn="0000000005")
    _hacer_libro(session, nombre="Cien años de soledad", isbn="0000000006")
    assert [l.nombre for l in libro_repo.listar_catalogo_filtrado(session, texto="ray")] == ["Rayuela"]
    assert libro_repo.listar_catalogo_filtrado(session, texto="000000000") != []


def test_listar_catalogo_filtrado_por_autor(session):
    autor = autor_repo.add(session, Autor(nombre="Borges"))
    libro1 = _hacer_libro(session, nombre="Ficciones", isbn="0000000007")
    libro1.autores.append(autor)
    _hacer_libro(session, nombre="Rayuela", isbn="0000000008")  # sin autor
    session.flush()
    assert [l.nombre for l in libro_repo.listar_catalogo_filtrado(session, autor="borge")] == ["Ficciones"]


def test_listar_catalogo_filtrado_por_genero(session):
    l1 = _hacer_libro(session, nombre="Ficciones", isbn="0000000009"); l1.genero = "Cuento"
    l2 = _hacer_libro(session, nombre="Rayuela", isbn="0000000010"); l2.genero = "Novela"
    session.flush()
    assert [l.nombre for l in libro_repo.listar_catalogo_filtrado(session, genero="Cuento")] == ["Ficciones"]


def test_listar_catalogo_filtrado_por_sedes(session):
    libro1 = _hacer_libro(session, nombre="Rayuela", isbn="0000000011")
    libro2 = _hacer_libro(session, nombre="Ficciones", isbn="0000000012")
    sede1, sede2 = (Sede(nombre=n, direccion="x") for n in ("Centro", "Norte"))
    session.add_all([sede1, sede2])
    session.flush()
    # Ejemplar DISPONIBLE del libro1 en sede1
    session.add(Ejemplar(codigo_inventario="E1", estado=EstadoEjemplar.DISPONIBLE,
                         libro_id=libro1.id, sede_origen_id=sede1.id, sede_actual_id=sede1.id))
    session.flush()
    assert [l.nombre for l in libro_repo.listar_catalogo_filtrado(session, sedes=[sede1.id])] == ["Rayuela"]
    assert libro_repo.listar_catalogo_filtrado(session, sedes=[sede2.id]) == []
    assert [l.nombre for l in libro_repo.listar_catalogo_filtrado(session, sedes=[sede1.id, sede2.id])] == ["Rayuela"]


def test_listar_catalogo_filtrado_orden_populares(session):
    from datetime import date
    from app.models.prestamo import Prestamo
    from app.models.enums import TipoPrestamo, EstadoPrestamo
    l1 = _hacer_libro(session, nombre="A", isbn="0000000013")
    l2 = _hacer_libro(session, nombre="B", isbn="0000000014")
    sede = Sede(nombre="Centro", direccion="x")
    session.add(sede)
    session.flush()
    ej = Ejemplar(codigo_inventario="E2", estado=EstadoEjemplar.PRESTADO,
                  libro_id=l2.id, sede_origen_id=sede.id, sede_actual_id=sede.id)
    session.add(ej)
    session.flush()
    socio = None  # necesitaremos un socio para prestamo; solo nos interesa contar prestamos, hacemos nested
    from app.repositories.socio_repository import SocioRepository
    from app.models.socio import Socio
    from app.models.usuario import Usuario
    from app.models.rol import Rol
    rol = Rol(nombre="Socio", descripcion="x")
    session.add(rol)
    session.flush()
    u = Usuario(nombre_usuario="test_orden", hash="x", rol_id=rol.id, sede_id=sede.id)
    session.add(u)
    session.flush()
    socio = Socio(nombre="T", apellido="T", dni="99999998", email="t@t.com", usuario_id=u.id)
    session.add(socio)
    session.flush()
    session.add(Prestamo(
        numero="P-001", tipo=TipoPrestamo.LOCAL, estado=EstadoPrestamo.ACTIVO,
        fecha_vencimiento=date(2030, 1, 1),
        socio_id=socio.id, ejemplar_id=ej.id,
    ))
    session.flush()
    res = libro_repo.listar_catalogo_filtrado(session, orden="populares")
    # B tiene 1 préstamo; A tiene 0 → B debe ir primero
    assert [l.nombre for l in res] == ["B", "A"]

