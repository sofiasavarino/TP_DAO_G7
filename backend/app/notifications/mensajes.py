"""Avisos al socio: acá se define QUÉ se dice y a quién.

Los services deciden *cuándo* avisar (`mensajes.avisar_reserva_lista(...)`) y este módulo
arma el título y el cuerpo, y se los pasa a `notificacion_service` (observer: persistir + mail).

Las funciones de reserva navegan `reserva.socio`, `reserva.libro` y `reserva.sede_retiro`,
así que la reserva tiene que estar persistida (flush) antes de llamarlas.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.ejemplar import Ejemplar
from app.models.enums import NotificacionTipo, TipoSancion
from app.models.reserva import Reserva
from app.models.sancion import Sancion
from app.models.socio import Socio
from app.notifications.service import notificacion_service


# ------------------------------------------------------------------------ reservas


def avisar_reserva_lista(session: Session, reserva: Reserva, ejemplar: Ejemplar) -> None:
    notificacion_service.notificar_a_socio(
        session,
        reserva.socio,
        NotificacionTipo.RESERVA_LISTA,
        "Tu ejemplar está listo",
        f"«{reserva.libro.nombre}» ({ejemplar.codigo_inventario}) te espera en "
        f"{reserva.sede_retiro.nombre} por 48 hs hábiles.",
    )


def avisar_ejemplar_asignado(session: Session, reserva: Reserva) -> None:
    notificacion_service.notificar_a_socio(
        session,
        reserva.socio,
        NotificacionTipo.EJEMPLAR_ASIGNADO,
        "Te asignamos un ejemplar",
        f"«{reserva.libro.nombre}» viaja hacia {reserva.sede_retiro.nombre}; "
        "te avisaremos cuando puedas retirarlo.",
    )


def avisar_reserva_vencida(session: Session, reserva: Reserva) -> None:
    notificacion_service.notificar_a_socio(
        session,
        reserva.socio,
        NotificacionTipo.RESERVA_VENCIDA,
        "Tu reserva venció",
        f"Pasó el plazo para retirar «{reserva.libro.nombre}». "
        "Si todavía lo querés, podés volver a reservarlo.",
    )


# ------------------------------------------------------------------------ sanciones


def avisar_sancion_aplicada(session: Session, socio: Socio, sancion: Sancion) -> None:
    if sancion.tipo == TipoSancion.MULTA:
        detalle = f"Multa de ${sancion.monto:.2f}."
    elif sancion.tipo == TipoSancion.REPOSICION:
        detalle = (
            "Quedaste dado de baja como socio. Para volver a asociarte tenés que reponer "
            "una copia del libro, de una edición igual o posterior."
        )
    else:
        hasta = f" hasta el {sancion.fecha_fin:%d/%m/%Y}" if sancion.fecha_fin else ""
        detalle = f"Suspensión de {sancion.dias_suspension} día(s){hasta}."
    notificacion_service.notificar_a_socio(
        session,
        socio,
        NotificacionTipo.SANCION_APLICADA,
        "Se te aplicó una sanción",
        f"{detalle} Motivo: {sancion.motivo}",
    )


def avisar_sancion_levantada(session: Session, socio: Socio, sancion: Sancion) -> None:
    notificacion_service.notificar_a_socio(
        session,
        socio,
        NotificacionTipo.SANCION_LEVANTADA,
        "Se levantó tu sanción",
        f"Se levantó la sanción: {sancion.motivo}",
    )
