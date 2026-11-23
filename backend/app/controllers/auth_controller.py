from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config.database import get_session
from app.exceptions import CredencialesInvalidas
from app.controllers.dependencies import get_current_user
from app.controllers.errores import error_de_alta
from app.dtos.auth_dto import LoginRequest, MeDTO, TokenDTO
from app.dtos.registro_dto import RegistroSocioRequest
from app.exceptions.base import BibliotecaError
from app.models.usuario import Usuario
from app.repositories.usuario_repository import UsuarioRepository
from app.services.auth_service import autenticar, to_me_dto
from app.services.usuario_service import registrar_socio

auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.post("/login", response_model=TokenDTO)
def login(datos: LoginRequest, session: Session = Depends(get_session)) -> TokenDTO:
    try:
        token = autenticar(session, datos.usuario, datos.password)
    except CredencialesInvalidas:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    return TokenDTO(access_token=token)

@auth_router.get("/me", response_model=MeDTO)
def me(usuario: Usuario = Depends(get_current_user)) -> MeDTO:
    return to_me_dto(usuario)


@auth_router.post("/registro", response_model=MeDTO, status_code=status.HTTP_201_CREATED)
def registro_socio(
    datos: RegistroSocioRequest, session: Session = Depends(get_session)
) -> MeDTO:
    """Autorregistro de socios (público). Crea el Usuario con rol Socio y su ficha de Socio.

    No devuelve token: el frontend hace login con las mismas credenciales.
    409 si el usuario, DNI o email ya existen; 400 si la sede no es válida.
    """
    try:
        usuario = registrar_socio(session, datos)
    except BibliotecaError as e:
        raise error_de_alta(e) from e
    session.commit()
    return to_me_dto(UsuarioRepository().get_con_detalle(session, usuario.id))
