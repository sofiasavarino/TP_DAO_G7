"""Endpoints de notificaciones del usuario logueado.

Todavía no hay autenticación: el `usuario_id` llega como query param (`?usuario_id=3`).
Cuando exista el login, se reemplaza ese parámetro por el usuario logueado.

Rutas finales (con el prefijo general /api/v1 al incluir el router):
    GET /api/v1/notificaciones/mios
    GET /api/v1/notificaciones/mios/no-leidas/cantidad
    PUT /api/v1/notificaciones/{notificacion_id}/leida
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

# AJUSTAR al nombre real de la dependencia que da la sesión (commit al final):
from app.config.database import get_session

from app.dtos.notificacion_dto import NotificacionDTO
from app.notifications import notificacion_service

router = APIRouter(prefix="/notificaciones", tags=["notificaciones"])


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
    # Se convierte a DTO acá, con la sesión todavía abierta.
    return NotificacionDTO.model_validate(notificacion)
