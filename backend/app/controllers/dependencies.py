"""Dependencias de seguridad para los routers.

Uso en cualquier endpoint:

    from app.controllers.dependencies import get_current_user, require_roles, ADMINISTRADOR

    @router.get("/algo")
    def algo(usuario: Usuario = Depends(get_current_user)): ...        # cualquier logueado

    @router.post("/sedes")
    def crear(usuario: Usuario = Depends(require_roles(ADMINISTRADOR))): ...   # solo admin

Si el endpoint solo restringe y no usa el usuario, se puede declarar en el decorador:
    @router.post("/sedes", dependencies=[Depends(require_roles(ADMINISTRADOR))])
"""

from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config.database import get_session
from app.models.usuario import Usuario
from app.repositories.usuario_repository import UsuarioRepository
from app.utils.security import TokenInvalido, decodificar_access_token

# Nombres exactos de los roles cargados en seeds.py
SOCIO = "Socio"
BIBLIOTECARIO = "Bibliotecario"
ADMINISTRADOR = "Administrador"

# auto_error=False para devolver nosotros un 401 (HTTPBearer sin credenciales da 403).
_bearer = HTTPBearer(auto_error=False)
_usuario_repo = UsuarioRepository()


def _no_autenticado(detalle: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detalle,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credenciales: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: Session = Depends(get_session),
) -> Usuario:
    """Devuelve el usuario dueño del token (`Authorization: Bearer ...`).

    401 si falta el token, es inválido/vencido, o el usuario ya no existe o fue dado de baja.
    """
    if credenciales is None:
        raise _no_autenticado("Falta el token de acceso")
    try:
        usuario_id = decodificar_access_token(credenciales.credentials)
    except TokenInvalido:
        raise _no_autenticado("Token inválido o vencido") from None

    usuario = _usuario_repo.get_con_detalle(session, usuario_id)  # solo activos
    if usuario is None:
        raise _no_autenticado("El usuario no existe o está dado de baja")
    return usuario


def require_roles(*roles: str) -> Callable[..., Usuario]:
    """Restringe un endpoint a los roles indicados. 403 si el rol no coincide.

    El Administrador siempre pasa: puede hacer todo lo del Socio y el Bibliotecario.
    """
    permitidos = set(roles) | {ADMINISTRADOR}

    def _verificar(usuario: Usuario = Depends(get_current_user)) -> Usuario:
        if usuario.rol.nombre not in permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tenés permiso para realizar esta acción",
            )
        return usuario

    return _verificar