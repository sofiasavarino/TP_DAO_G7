import unicodedata


def unaccent(s: str | None) -> str | None:
    """Quita tildes/diacríticos y pasa a minúsculas. Espeja la UDF `unaccent` registrada
    en SQLite (ver `config/database.py`). Úsese tanto para construir el patrón a buscar
    como para normalizar en Python lo que tipeo el usuario."""
    if s is None:
        return None
    s = s.lower().strip()
    return "".join(
        char for char in unicodedata.normalize("NFKD", s) if unicodedata.category(char) != "Mn"
    )
