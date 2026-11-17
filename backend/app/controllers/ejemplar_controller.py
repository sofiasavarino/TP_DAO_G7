from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config.database import get_session
from app.dtos.ejemplar_dto import EjemplarCreate, EjemplarDTO, EjemplarEstadoUpdate
from app.repositories.ejemplar_repository import EjemplarRepository
from app.services.ejemplar_service import (
    cambiar_estado,
    crear_ejemplar,
    listar_disponibles,
    listar_por_libro,
)

ejemplar_router = APIRouter(prefix="/ejemplares", tags=["ejemplares"])
ejemplar_repo = EjemplarRepository()


@ejemplar_router.get("/disponibles", response_model=list[EjemplarDTO])
def listar_disponibles_endpoint(
    libro_id: int | None = None,
    sede_id: int | None = None,
    session: Session = Depends(get_session),
) -> list[EjemplarDTO]:
    """Consulta de disponibilidad por libro y/o sede ACTUAL del ejemplar."""
    return [EjemplarDTO.model_validate(e) for e in listar_disponibles(session, libro_id=libro_id, sede_id=sede_id)]


@ejemplar_router.get("/por-libro/{libro_id}", response_model=list[EjemplarDTO])
def listar_por_libro_endpoint(
    libro_id: int, session: Session = Depends(get_session)
) -> list[EjemplarDTO]:
    return [EjemplarDTO.model_validate(e) for e in listar_por_libro(session, libro_id)]


@ejemplar_router.post("", response_model=EjemplarDTO, status_code=201)
def crear_ejemplar_endpoint(datos: EjemplarCreate, session: Session = Depends(get_session)) -> EjemplarDTO:
    try:
        ejemplar = crear_ejemplar(session, datos)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    session.commit()
    return EjemplarDTO.model_validate(ejemplar)


@ejemplar_router.patch("/{ejemplar_id}/estado", response_model=EjemplarDTO)
def cambiar_estado_endpoint(
    ejemplar_id: int, body: EjemplarEstadoUpdate, session: Session = Depends(get_session)
) -> EjemplarDTO:
    try:
        ejemplar = cambiar_estado(session, ejemplar_id, body.estado)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    session.commit()
    return EjemplarDTO.model_validate(ejemplar)
