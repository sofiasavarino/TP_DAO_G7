import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[2]

# `override=False`: quien exporta la variable en su shell antes de editar el .env
# (p. ej. CI) no ve su override anulado por el archivo.
load_dotenv(BACKEND_ROOT / ".env", override=False)

GOOGLE_BOOKS_API_KEY: str = os.getenv("GOOGLE_BOOKS_API_KEY", "").strip()


def _require_api_key() -> str:
    if not GOOGLE_BOOKS_API_KEY:
        raise RuntimeError(
            "Falta GOOGLE_BOOKS_API_KEY. Completala en backend/.env "
            "(o exportala en tu shell) y reiniciaste el proceso."
        )
    return GOOGLE_BOOKS_API_KEY
