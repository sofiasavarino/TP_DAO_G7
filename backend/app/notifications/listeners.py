"""Listeners del patrón Observer para notificaciones.

`EventListener` es la interfaz del suscriptor (`update(data)`). Los concretos reaccionan
al evento `NotificacionEvento`: persistir la fila y/o mandar el mail.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from functools import partial

from sqlalchemy.orm import Session

from app.models.notificacion import Notificacion
from app.models.usuario import Usuario
from app.utils.despues_del_commit import despues_del_commit
from app.notifications.mail import enviar_mail, renderizar_mail


@dataclass
class NotificacionEvento:
    """Datos que viajan en el evento (equivalente al `filename` del ejemplo).

    `usuario` ya viene cargado de `notificar` para no consultarlo de nuevo.
    """

    session: Session
    notificacion: Notificacion
    usuario: Usuario


class EventListener(ABC):
    """Suscriptor: reacciona a un evento.

    `critico=True` marca al listener como parte del camino obligatorio: si falla,
    el broadcast se detiene (propaga) y los listeners no-críticos no corren.
    """

    critico: bool = False

    @abstractmethod
    def update(self, data: NotificacionEvento) -> None:
        ...


class PersistirListener(EventListener):
    """Persiste la notificación en la base. Es CRÍTICO: si no se guarda, no se notifica."""

    critico = True

    def update(self, data: NotificacionEvento) -> None:
        data.session.add(data.notificacion)
        data.session.flush()


class MailListener(EventListener):
    """Manda el mail de la notificación (console o SMTP según `EMAIL_BACKEND`).

    No lo manda en el momento: arma el mail con la sesión todavía activa y lo encola con
    `despues_del_commit`, así sale recién cuando la transacción se confirma. Si hay rollback,
    no sale nada. Encola solo strings (no objetos del ORM), porque después del commit
    esos objetos están expirados.
    """

    def update(self, data: NotificacionEvento) -> None:
        notificacion = data.notificacion
        destino = data.usuario.email
        asunto = notificacion.titulo
        cuerpo = renderizar_mail(
            "notificacion.txt",
            usuario=data.usuario.nombre_usuario,
            titulo=notificacion.titulo,
            cuerpo=notificacion.cuerpo,
        )
        despues_del_commit(data.session, partial(enviar_mail, destino, asunto, cuerpo))
