import requests

from app.config.settings import _require_api_key

_URL = "https://www.googleapis.com/books/v1/volumes"
_TIMEOUT = 10


def buscar_por_isbn(isbn: str) -> dict | None:
    """Devuelve el primer item del catálogo de Google Books para ese ISBN, o None.

    Lanza RuntimeError si falta la API key; lanza ConnectionError/Timeout tal cual va
    de `requests` para que el service pueda capturarlos.
    """
    key = _require_api_key()
    resp = requests.get(
        _URL,
        params={"q": f"isbn:{isbn}", "printType": "books", "maxResults": 1, "key": key},
        timeout=_TIMEOUT,
    )
    if resp.status_code != 200:
        return None
    payload = resp.json()
    items = payload.get("items", [])
    return items[0] if items else None
