from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_session
from app.controllers.dependencies import get_current_user
from app.dtos.sede_dto import SedeDTO
from app.repositories.sede_repository import SedeRepository

sede_router = APIRouter(prefix="/sedes", tags=["sedes"])
sede_repo = SedeRepository()


@sede_router.get("", response_model=list[SedeDTO], dependencies=[Depends(get_current_user)])
def listar_sedes(session: Session = Depends(get_session)) -> list[SedeDTO]:
    """Sedes activas, para los selectores del front (filtros, alta de ejemplares, retiro)."""
    return [SedeDTO.model_validate(s) for s in sede_repo.list_activos(session)]
