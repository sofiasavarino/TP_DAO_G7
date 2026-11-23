from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config.database import get_session
from app.controllers.dependencies import ADMINISTRADOR, BIBLIOTECARIO, require_roles
from app.dtos.ejemplar_dto import (
    EjemplarCreate,
    EjemplarDTO,
    EjemplarEstadoUpdate,
    EjemplarInventarioDTO,
    EjemplarLoteCreate,
)
from app.exceptions.catalogo import (
    EjemplarNoEncontrado,
    LibroNoEncontrado,
    SedeNoPermitida,
    TransicionEjemplarInvalida,
)
from app.exceptions.prestamo import EjemplarNoDisponible
from app.models.enums import EstadoEjemplar
from app.models.usuario import Usuario
from app.repositories.ejemplar_repository import EjemplarRepository
from app.services.ejemplar_service import (
    aplicar_accion,
    cambiar_estado,
    crear_ejemplar,
    crear_ejemplares_lote,
    listar_disponibles,
    listar_inventario,
    listar_por_libro,
)

_solo_personal = [Depends(require_roles(BIBLIOTECARIO))]
_personal = require_roles(BIBLIOTECARIO)


def _sede_permitida(usuario: Usuario) -> int | None:
    """El administrador gestiona toda la red; el bibliotecario, solo su sede."""
    return None if usuario.rol.nombre == ADMINISTRADOR else usuario.sede_id

ejemplar_router = APIRouter(prefix="/ejemplares", tags=["ejemplares"])
ejemplar_repo = EjemplarRepository()


@ejemplar_router.get("", response_model=list[EjemplarInventarioDTO], dependencies=_solo_personal)
def listar_inventario_endpoint(
    libro_id: int | None = None,
    sede_id: int | None = None,
    estado: EstadoEjemplar | None = None,
    session: Session = Depends(get_session),
) -> list[EjemplarInventarioDTO]:
    """Inventario físico (todos los estados) filtrable por libro, sede actual y estado."""
    ejemplares = listar_inventario(session, libro_id=libro_id, sede_id=sede_id, estado=estado)
    return [EjemplarInventarioDTO.model_validate(e) for e in ejemplares]


@ejemplar_router.post("/lote", response_model=list[EjemplarInventarioDTO], status_code=201)
def crear_lote_endpoint(
    datos: EjemplarLoteCreate,
    session: Session = Depends(get_session),
    usuario: Usuario = Depends(_personal),
) -> list[EjemplarInventarioDTO]:
    """Alta rápida de 1..50 copias de un libro en una sede (códigos autogenerados).
    El bibliotecario solo puede dar de alta en su sede (403 si no)."""
    try:
        ejemplares = crear_ejemplares_lote(session, datos, _sede_permitida(usuario))
    except SedeNoPermitida as e:
        raise HTTPException(403, str(e)) from e
    except LibroNoEncontrado as e:
        raise HTTPException(404, str(e)) from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    session.commit()
    return [EjemplarInventarioDTO.model_validate(e) for e in ejemplares]


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
    except EjemplarNoDisponible as e:  # TransicionInvalida: el estado actual no admite el cambio
        raise HTTPException(409, str(e)) from e
    session.commit()
    return EjemplarDTO.model_validate(ejemplar)


def _accion(session: Session, usuario: Usuario, ejemplar_id: int, accion: str) -> EjemplarInventarioDTO:
    try:
        ejemplar = aplicar_accion(session, ejemplar_id, accion, _sede_permitida(usuario))
    except EjemplarNoEncontrado as e:
        raise HTTPException(404, str(e)) from e
    except SedeNoPermitida as e:
        raise HTTPException(403, str(e)) from e
    except TransicionEjemplarInvalida as e:
        raise HTTPException(409, str(e)) from e
    session.commit()
    return EjemplarInventarioDTO.model_validate(ejemplar)


@ejemplar_router.patch("/{ejemplar_id}/reparacion", response_model=EjemplarInventarioDTO)
def enviar_a_reparacion_endpoint(
    ejemplar_id: int, session: Session = Depends(get_session), usuario: Usuario = Depends(_personal)
) -> EjemplarInventarioDTO:
    """DISPONIBLE -> EN_REPARACION."""
    return _accion(session, usuario, ejemplar_id, "enviar_a_reparacion")


@ejemplar_router.patch("/{ejemplar_id}/reincorporacion", response_model=EjemplarInventarioDTO)
def reincorporar_endpoint(
    ejemplar_id: int, session: Session = Depends(get_session), usuario: Usuario = Depends(_personal)
) -> EjemplarInventarioDTO:
    """EN_REPARACION -> DISPONIBLE."""
    return _accion(session, usuario, ejemplar_id, "reincorporar")


@ejemplar_router.patch("/{ejemplar_id}/inutilizable", response_model=EjemplarInventarioDTO)
def marcar_inutilizable_endpoint(
    ejemplar_id: int, session: Session = Depends(get_session), usuario: Usuario = Depends(_personal)
) -> EjemplarInventarioDTO:
    """DISPONIBLE / EN_REPARACION -> INUTILIZABLE (terminal, no se puede deshacer)."""
    return _accion(session, usuario, ejemplar_id, "marcar_inutilizable")
