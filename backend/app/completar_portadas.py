"""Completa la portada (`imagen_url`) de los libros que no tienen.

Uso: desde `backend/`:

    python -m app.completar_portadas            # solo libros sin imagen
    python -m app.completar_portadas --forzar   # vuelve a buscar la portada de todos

Para cada libro prueba, en orden:
1. Google Books por ISBN (`volumeInfo.imageLinks.thumbnail`);
2. Google Books por título + primer autor (el primer resultado que traiga imagen);
3. Open Library por ISBN (`covers.openlibrary.org`, no necesita API key).

Sin `GOOGLE_BOOKS_API_KEY` en `backend/.env` usa solo Open Library. Idempotente: se puede
correr las veces que haga falta (por defecto no toca los libros que ya tienen portada).
"""

from __future__ import annotations

import sys
import time

import requests
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config.database import SessionLocal
from app.integrations.googlebooks import buscar, buscar_por_isbn, item_a_libro_dto
from app.models.libro import Libro

_OPEN_LIBRARY = "https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg"
_PAUSA = 0.2  # segundos entre libros, para no saturar las APIs


def _portada_google(libro: Libro) -> str | None:
    """Thumbnail de Google Books por ISBN y, si no hay, por título + autor."""
    if libro.isbn:
        item = buscar_por_isbn(libro.isbn)
        if item and (url := item_a_libro_dto(item).imagen_url):
            return url
    consulta = f'intitle:"{libro.nombre}"'
    if libro.autores:
        consulta += f' inauthor:"{libro.autores[0].nombre}"'
    for item in buscar(consulta, max_results=5):
        if url := item_a_libro_dto(item).imagen_url:
            return url
    return None


def _portada_open_library(isbn: str | None) -> str | None:
    """Open Library responde 404 con `default=false` cuando no tiene la tapa."""
    if not isbn:
        return None
    url = _OPEN_LIBRARY.format(isbn=isbn)
    resp = requests.head(f"{url}?default=false", timeout=10, allow_redirects=True)
    return url if resp.status_code == 200 else None


def main() -> None:
    forzar = "--forzar" in sys.argv
    usar_google = True
    encontradas = sin_portada = 0

    with SessionLocal() as session:
        stmt = select(Libro).options(selectinload(Libro.autores)).order_by(Libro.id)
        if not forzar:
            stmt = stmt.where(Libro.imagen_url.is_(None))
        libros = list(session.scalars(stmt))
        print(f"Libros a revisar: {len(libros)}")

        for libro in libros:
            url = None
            try:
                if usar_google:
                    url = _portada_google(libro)
            except RuntimeError as e:  # falta la API key: seguimos solo con Open Library
                print(f"  (sin Google Books: {e})")
                usar_google = False
            except requests.RequestException as e:
                print(f"  ! Google Books falló para '{libro.nombre}': {e}")
            if url is None:
                try:
                    url = _portada_open_library(libro.isbn)
                except requests.RequestException as e:
                    print(f"  ! Open Library falló para '{libro.nombre}': {e}")

            if url:
                libro.imagen_url = url
                encontradas += 1
                print(f"  ✓ {libro.nombre}")
            else:
                sin_portada += 1
                print(f"  – {libro.nombre}: sin portada")
            time.sleep(_PAUSA)

        session.commit()

    print(f"Listo: {encontradas} portadas guardadas, {sin_portada} libros siguen sin imagen.")


if __name__ == "__main__":
    main()
