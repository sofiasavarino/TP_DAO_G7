"""POST /api/v1/auth/login y GET /api/v1/auth/me."""

URL_LOGIN = "/api/v1/auth/login"


def _usuario_con_clave(fabrica, rol="Socio"):
    return fabrica.usuario(rol=rol, nombre_usuario="ana", password="clave-correcta")


def test_login_con_credenciales_buenas_devuelve_token(client, fabrica):
    _usuario_con_clave(fabrica)

    r = client.post(URL_LOGIN, json={"usuario": "ana", "password": "clave-correcta"})

    assert r.status_code == 200 and r.json()["access_token"]


def test_login_con_password_incorrecta_da_401(client, fabrica):
    _usuario_con_clave(fabrica)

    r = client.post(URL_LOGIN, json={"usuario": "ana", "password": "otra-clave"})

    assert r.status_code == 401


def test_login_con_usuario_inexistente_da_401(client):
    r = client.post(URL_LOGIN, json={"usuario": "nadie", "password": "lo-que-sea"})

    assert r.status_code == 401


def test_login_sin_password_da_422(client):
    r = client.post(URL_LOGIN, json={"usuario": "ana"})

    assert r.status_code == 422


def test_token_del_login_sirve_para_me(client, fabrica):
    _usuario_con_clave(fabrica)
    token = client.post(
        URL_LOGIN, json={"usuario": "ana", "password": "clave-correcta"}
    ).json()["access_token"]

    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert r.json()["nombre_usuario"] == "ana"


def test_me_sin_token_da_401(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_me_con_token_trucho_da_401(client):
    r = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer no.es.un.jwt"})

    assert r.status_code == 401
