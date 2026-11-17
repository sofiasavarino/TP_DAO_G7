from datetime import date
from typing import Literal

from app.dtos.googlebooks_dto import LibroLookupDTO

_PREFERRED_ID_TYPES = ("ISBN_13", "ISBN_10")


def _parse_fecha(valor: str | None) -> date | None:
    if not valor:
        return None
    partes = valor.split("-")
    if not partes or not partes[0].isdigit():
        return None
    anio = int(partes[0])
    mes = int(partes[1]) if len(partes) > 1 and partes[1].isdigit() else 1
    dia = int(partes[2]) if len(partes) > 2 and partes[2].isdigit() else 1
    try:
        return date(anio, mes, dia)
    except ValueError:
        return date(anio, 1, 1)


def _isbn(identifiers: list[dict]) -> str | None:
    for preferred in _PREFERRED_ID_TYPES:
        for ident in identifiers:
            if ident.get("type") == preferred and ident.get("identifier"):
                return ident["identifier"]
    return None


def _imagen_url(image_links: dict | None) -> str | None:
    if not image_links:
        return None
    url = image_links.get("thumbnail") or image_links.get("smallThumbnail")
    if not url:
        return None
    # Google a veces devuelve http://; http->https en el cliente evita mixto.
    return url.replace("http://", "https://", 1)


def item_a_libro_dto(item: dict, origen: Literal["LOCAL", "GOOGLE", "MANUAL"] = "GOOGLE") -> LibroLookupDTO:
    vi = item.get("volumeInfo", {})
    return LibroLookupDTO(
        origen=origen,
        nombre=(vi.get("title") or "").strip() or None,
        isbn=_isbn(vi.get("industryIdentifiers", [])),
        cant_paginas=vi.get("pageCount"),
        editorial=(vi.get("publisher") or "").strip() or None,
        fecha_publicacion=_parse_fecha(vi.get("publishedDate")),
        imagen_url=_imagen_url(vi.get("imageLinks")),
        autores=[a for a in (vi.get("authors") or []) if isinstance(a, str)],
    )
