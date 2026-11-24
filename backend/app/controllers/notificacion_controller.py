"""Endpoints de notificaciones del usuario logueado.

Requieren sesión: el `usuario_id` se pasa como query param por compatibilidad con el front
hasta que se reemplace por el usuario del token en el service.

Rutas finales (con el prefijo general /api/v1 al incluir el router):
    GET /api/v1/notificaciones/mios
    GET /api/v1/notificaciones/mios/no-leidas/cantidad
    PUT /api/v1/notificaciones/{notificacion_id}/leida
    PUT /api/v1/notificaciones/mios/leidas
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

# AJUSTAR al nombre real de la dependencia que da la sesión (commit al final):
from app.config.database import get_session
from app.controllers.dependencies import get_current_user

from app.dtos.notificacion_dto import NotificacionDTO
from app.notifications import notificacion_service
from app.repositories.notificacion_repository import NotificacionRepository

notificacion_repo = NotificacionRepository()

router = APIRouter(
    prefix="/notificaciones", tags=["notificaciones"], dependencies=[Depends(get_current_user)]
)


@router.get("/mios", response_model=list[NotificacionDTO])
def mis_notificaciones(
    usuario_id: int,
    solo_no_leidas: bool = False,
    session: Session = Depends(get_session),
):
    """Notificaciones del usuario logueado, de la más nueva a la más vieja.

    Con `?solo_no_leidas=true` devuelve solo la bandeja de no leídas.
    """
    # `usuario_id` es el del *usuario* (no `socio.id`): la notificación es del usuario.
    if solo_no_leidas:
        return notificacion_service.listar_no_leidas(session, usuario_id)
    return notificacion_service.listar_historial(session, usuario_id)


@router.get("/mios/no-leidas/cantidad")
def cantidad_no_leidas(
    usuario_id: int,
    session: Session = Depends(get_session),
):
    """Cantidad de notificaciones sin leer del usuario logueado (globito de la campanita)."""
    return {"cantidad": notificacion_service.contar_no_leidas(session, usuario_id)}


@router.put("/{notificacion_id}/leida", response_model=NotificacionDTO)
def marcar_leida(
    notificacion_id: int,
    usuario_id: int,
    session: Session = Depends(get_session),
):
    """Marca como leída una notificación del usuario logueado (idempotente)."""
    try:
        notificacion = notificacion_service.marcar_leida(session, notificacion_id, usuario_id)
    except ValueError as e:  # no existe o no es del usuario
        raise HTTPException(status_code=400, detail=str(e)) from e
    session.commit()  # get_session no confirma solo: sin esto el cambio se perdía
    # Se convierte a DTO acá, con la sesión todavía abierta.
    return NotificacionDTO.model_validate(notificacion)


@router.put("/mios/leidas")
def marcar_todas_leidas(
    usuario_id: int,
    session: Session = Depends(get_session),
):
    """Marca como leídas todas las notificaciones del usuario. Devuelve cuántas cambió."""
    marcadas = notificacion_repo.marcar_todas_leidas(session, usuario_id)
    session.commit()
    return {"marcadas": marcadas}
