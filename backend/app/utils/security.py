from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.config import settings

# Argon2id con los parámetros por defecto de la librería (recomendados por OWASP).
# El hash resultante incluye el salt y los parámetros: '$argon2id$v=19$m=...$salt$hash'
_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    """Devuelve el hash argon2id de la contraseña (con salt aleatorio incluido)."""
    return _hasher.hash(password)


def verify_password(password: str, stored: str) -> bool:
    """Verifica una contraseña contra un hash generado por `hash_password`."""
    try:
        return _hasher.verify(stored, password)  # ojo: primero el hash, después la clave
    except (VerificationError, InvalidHashError):
        return False


# --------------------------------------------------------------------------- JWT


class TokenInvalido(Exception):
    """El token no es válido: firma incorrecta, malformado, vencido o sin `sub`."""


def crear_access_token(usuario_id: int, expira_minutos: int | None = None) -> str:
    """Firma un JWT (HS256 por defecto) con el id del usuario como `sub`.

    El secreto sale de `JWT_SECRET` y nunca viaja al frontend: el frontend solo
    recibe el token ya firmado.
    """
    ahora = datetime.now(timezone.utc)
    minutos = settings.JWT_EXPIRE_MINUTES if expira_minutos is None else expira_minutos
    payload = {
        "sub": str(usuario_id),  # el estándar exige que `sub` sea string
        "iat": ahora,
        "exp": ahora + timedelta(minutes=minutos),
    }
    return jwt.encode(payload, settings._require_jwt_secret(), algorithm=settings.JWT_ALGORITHM)


def decodificar_access_token(token: str) -> int:
    """Verifica firma y vencimiento. Devuelve el id de usuario o lanza `TokenInvalido`."""
    try:
        payload = jwt.decode(
            token,
            settings._require_jwt_secret(),
            algorithms=[settings.JWT_ALGORITHM],  # lista fija: evita el ataque "alg=none"
            options={"require": ["exp", "sub"]},
        )
        return int(payload["sub"])
    except (jwt.PyJWTError, ValueError) as exc:
        raise TokenInvalido(str(exc)) from exc