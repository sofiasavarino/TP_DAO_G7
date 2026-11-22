from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config.database import get_session
from app.exceptions import CredencialesInvalidas
from app.controllers.dependencies import get_current_user
from app.dtos.auth_dto import LoginRequest, MeDTO, TokenDTO
from app.models.usuario import Usuario
from app.services.auth_service import autenticar, to_me_dto

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