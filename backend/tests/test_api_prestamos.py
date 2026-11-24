"""/api/v1/prestamos: permisos por rol.

El listado general y el alta son de mostrador (Bibliotecario; el Administrador siempre
pasa). Un Socio logueado recibe 403; sin token, 401.
"""

from app.models.enums import EstadoEjemplar

URL = "/api/v1/prestamos"


def test_listar_prestamos_sin_token_da_401(client):
    assert client.get(URL).status_code == 401


def test_listar_prestamos_como_socio_da_403(client, fabrica, token_de):
    socio = fabrica.socio()

    r = client.get(URL, headers=token_de(socio.usuario))

    assert r.status_code == 403


def test_listar_prestamos_como_bibliotecario_da_200(client, fabrica, token_de):
    biblio = fabrica.usuario(rol="Bibliotecario")

    r = client.get(URL, headers=token_de(biblio))

    assert r.status_code == 200


def test_listar_prestamos_como_administrador_da_200(client, fabrica, token_de):
    admin = fabrica.usuario(rol="Administrador")

    r = client.get(URL, headers=token_de(admin))

    assert r.status_code == 200


def test_listar_prestamos_devuelve_los_existentes(client, fabrica, token_de):
    sede = fabrica.sede()
    ej = fabrica.ejemplar(fabrica.libro(), sede, EstadoEjemplar.PRESTADO)
    prestamo = fabrica.prestamo(fabrica.socio(sede), ej)

    r = client.get(URL, headers=token_de(fabrica.usuario(rol="Administrador")))

    assert [p["numero"] for p in r.json()] == [prestamo.numero]


def test_mis_prestamos_como_socio_da_200(client, fabrica, token_de):
    socio = fabrica.socio()

    r = client.get(f"{URL}/mios", params={"socio_id": socio.id}, headers=token_de(socio.usuario))

    assert r.status_code == 200


def test_crear_prestamo_como_socio_da_403(client, fabrica, token_de):
    sede = fabrica.sede()
    socio = fabrica.socio(sede)
    ej = fabrica.ejemplar(fabrica.libro(), sede)

    r = client.post(
        URL,
        json={"socio_id": socio.id, "ejemplar_id": ej.id, "tipo": "LOCAL"},
        headers=token_de(socio.usuario),
    )

    assert r.status_code == 403


def test_crear_prestamo_como_bibliotecario_da_201_y_presta_el_ejemplar(
    client, fabrica, token_de
):
    sede = fabrica.sede()
    socio = fabrica.socio(sede)
    ej = fabrica.ejemplar(fabrica.libro(), sede)

    r = client.post(
        URL,
        json={"socio_id": socio.id, "ejemplar_id": ej.id, "tipo": "LOCAL"},
        headers=token_de(fabrica.usuario(rol="Bibliotecario", sede=sede)),
    )

    assert (r.status_code, ej.estado) == (201, EstadoEjemplar.PRESTADO)


def test_crear_prestamo_de_ejemplar_no_disponible_da_409(client, fabrica, token_de):
    sede = fabrica.sede()
    socio = fabrica.socio(sede)
    ej = fabrica.ejemplar(fabrica.libro(), sede, EstadoEjemplar.EN_REPARACION)

    r = client.post(
        URL,
        json={"socio_id": socio.id, "ejemplar_id": ej.id, "tipo": "LOCAL"},
        headers=token_de(fabrica.usuario(rol="Bibliotecario", sede=sede)),
    )

    assert r.status_code == 409
