from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.config.database import get_session
from app.controllers.dependencies import ADMINISTRADOR, require_roles
from app.controllers.errores import error_de_alta
from app.dtos.registro_dto import EmpleadoListadoDTO, RegistroBibliotecarioRequest
from app.exceptions.base import BibliotecaError
from app.services.usuario_service import (
    listar_bibliotecarios,
    registrar_bibliotecario,
    to_empleado_listado_dto,
)

# Todo este router es solo para el Administrador.
usuario_router = APIRouter(
    prefix="/usuarios",
    tags=["usuarios"],
    dependencies=[Depends(require_roles(ADMINISTRADOR))],
)


@usuario_router.get("/bibliotecarios", response_model=list[EmpleadoListadoDTO])
def listar_bibliotecarios_endpoint(
    session: Session = Depends(get_session),
) -> list[EmpleadoListadoDTO]:
    """Personal con rol Bibliotecario (incluye los dados de baja)."""
    return [to_empleado_listado_dto(e) for e in listar_bibliotecarios(session)]


@usuario_router.post(
    "/bibliotecarios",
    response_model=EmpleadoListadoDTO,
    status_code=status.HTTP_201_CREATED,
)
def registrar_bibliotecario_endpoint(
    datos: RegistroBibliotecarioRequest, session: Session = Depends(get_session)
) -> EmpleadoListadoDTO:
    """Alta de un bibliotecario: crea su Usuario (rol Bibliotecario) y su ficha de Empleado.

    409 si el usuario, email o legajo ya existen; 400 si la sede no es válida.
    """
    try:
        empleado = registrar_bibliotecario(session, datos)
    except BibliotecaError as e:
        raise error_de_alta(e) from e
    session.commit()
    return to_empleado_listado_dto(empleado)
