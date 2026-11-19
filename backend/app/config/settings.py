import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[2]

# `.env` es opcional en prod; los placeholders de DB caen a `biblioteca.db` local.
load_dotenv(BACKEND_ROOT / ".env", override=False)

# Si DATABASE_URL es relativo, lo anclamos a BACKEND_ROOT (la carpeta que contiene a `app/`)
# para que el engine no dependa del cwd desde el que se levanta la app.
_database_url = os.getenv("DATABASE_URL", "sqlite:///biblioteca.db").strip()
if _database_url.startswith("sqlite:///") and not Path(_database_url[10:]).is_absolute():
    DATABASE_URL = f"sqlite:///{BACKEND_ROOT / _database_url[10:]}"
else:
    DATABASE_URL = _database_url

# Integración externa
GOOGLE_BOOKS_API_KEY: str = os.getenv("GOOGLE_BOOKS_API_KEY", "").strip()

# Seguridad / JWT
JWT_SECRET: str = os.getenv("JWT_SECRET", "").strip()
JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))

# Email — `console` loguea el mail, `gmail` lo manda por SMTP de Gmail real
SMTP_HOST: str = os.getenv("SMTP_HOST", "")
SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER: str = os.getenv("SMTP_USER", "")
SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
EMAIL_BACKEND: str = os.getenv("EMAIL_BACKEND", "console")


def _require_api_key() -> str:
    if not GOOGLE_BOOKS_API_KEY:
        raise RuntimeError(
            "Falta GOOGLE_BOOKS_API_KEY. Completala en backend/.env "
            "(o exportala en tu shell) y reiniciaste el proceso."
        )
    return GOOGLE_BOOKS_API_KEY


def _require_jwt_secret() -> str:
    if not JWT_SECRET:
        raise RuntimeError(
            "Falta JWT_SECRET. Completala en backend/.env con un valor "
            "random largo (p. ej. `python -c 'import secrets; print(secrets.token_urlsafe(48))'`)."
        )
    return JWT_SECRET
