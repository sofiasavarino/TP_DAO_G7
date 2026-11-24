"""Reincorporación de un ejemplar: el estado físico se puede editar (o limpiar)."""

import pytest

from app.models.ejemplar import Ejemplar
from app.models.enums import EstadoEjemplar
from app.models.libro import Libro
from app.models.rol import Rol
from app.models.sede import Sede
from app.models.usuario import Usuario
from app.services.ejemplar_service import aplicar_accion
from app.utils.security import hash_password

NOTA = "Tapa rota y páginas sueltas"


def _contexto(session):
    sede = Sede(nombre="Centro", direccion="Calle 1")
    session.add(sede)
    session.flush()
    rol = Rol(nombre="Administrador", descripcion="admin de prueba")
    session.add(rol)
    session.flush()
    usuario = Usuario(
        nombre_usuario="admin_reinc", email="reinc@test.com",
        hash=hash_password("admin123"), rol_id=rol.id, sede_id=sede.id,
    )
    session.add(usuario)
    libro = Libro(nombre="Libro a reparar")
    session.add(libro)
    session.flush()
    ejemplar = Ejemplar(
        codigo_inventario="E-REINC", estado=EstadoEjemplar.EN_REPARACION,
        descripcion_fisica=NOTA, libro_id=libro.id,
        sede_origen_id=sede.id, sede_actual_id=sede.id,
    )
    session.add(ejemplar)
    session.flush()
    return usuario, ejemplar


def test_reincorporar_actualiza_estado_fisico(session):
    _usuario, ej = _contexto(session)
    actualizado = aplicar_accion(
        session, ej.id, "reincorporar",
        descripcion_fisica="  Restaurado, sin desperfectos  ",
        actualizar_descripcion=True,
    )
    assert actualizado.estado == EstadoEjemplar.DISPONIBLE
    assert actualizado.descripcion_fisica == "Restaurado, sin desperfectos"


def test_reincorporar_con_nota_vacia_limpia_el_estado_fisico(session):
    _usuario, ej = _contexto(session)
    actualizado = aplicar_accion(
        session, ej.id, "reincorporar", descripcion_fisica="   ", actualizar_descripcion=True
    )
    assert actualizado.descripcion_fisica is None
    assert actualizado.estado == EstadoEjemplar.DISPONIBLE


def test_reincorporar_sin_cuerpo_conserva_la_nota(session):
    _usuario, ej = _contexto(session)
    actualizado = aplicar_accion(session, ej.id, "reincorporar")
    assert actualizado.descripcion_fisica == NOTA
    assert actualizado.estado == EstadoEjemplar.DISPONIBLE


def test_nota_demasiado_larga_se_rechaza_y_no_cambia_el_estado(session):
    _usuario, ej = _contexto(session)
    with pytest.raises(ValueError, match="200 caracteres"):
        aplicar_accion(
            session, ej.id, "reincorporar", descripcion_fisica="x" * 201,
            actualizar_descripcion=True,
        )
    assert ej.estado == EstadoEjemplar.EN_REPARACION
    assert ej.descripcion_fisica == NOTA


def test_endpoint_acepta_cuerpo_opcional_y_devuelve_la_nota(client, session):
    _usuario, ej = _contexto(session)
    token = client.post(
        "/api/v1/auth/login", json={"usuario": "admin_reinc", "password": "admin123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r = client.patch(
        f"/api/v1/ejemplares/{ej.id}/reincorporacion",
        json={"descripcion_fisica": "Reencuadernado"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "DISPONIBLE"
    assert r.json()["descripcion_fisica"] == "Reencuadernado"


def test_endpoint_sin_cuerpo_sigue_funcionando(client, session):
    _usuario, ej = _contexto(session)
    token = client.post(
        "/api/v1/auth/login", json={"usuario": "admin_reinc", "password": "admin123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r = client.patch(f"/api/v1/ejemplares/{ej.id}/reincorporacion", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["descripcion_fisica"] == NOTA
