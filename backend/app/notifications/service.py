"""Publisher concreto (el "Editor" del ejemplo): genera eventos de notificación.

Valida el usuario, crea la `Notificacion` y dispara `events.notify(tipo, evento)`;
los listeners suscriptos (por tipo de evento) hacen el resto.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.dtos.notificacion_dto import NotificacionCreate
from app.models.enums import NotificacionTipo
from app.models.notificacion import Notificacion
from app.models.socio import Socio
from app.repositories.usuario_repository import UsuarioRepository
from app.notifications.event_manager import EventManager
from app.notifications.listeners import (
    EventListener,
    MailListener,
    NotificacionEvento,
    PersistirListener,
)

usuario_repo = UsuarioRepository()


class NotificacionService:
    def __init__(self, events: EventManager | None = None) -> None:
        self.events = events if events is not None else EventManager()
        # Una sola instancia de cada listener, reutilizada en todos los tipos de evento.
        persistir_listener = PersistirListener()
        mail_listener = MailListener()
        for tipo in NotificacionTipo:
            self.events.subscribe(tipo.value, persistir_listener)
            self.events.subscribe(tipo.value, mail_listener)

    def subscribe(self, tipo: NotificacionTipo, listener: EventListener) -> None:
        """Permite agregar listeners por tipo de evento en runtime (como en el ejemplo)."""
        self.events.subscribe(tipo.value, listener)

    def notificar_a_socio(
        self, session: Session, socio: Socio, tipo: NotificacionTipo, titulo: str, cuerpo: str
    ) -> Notificacion:
        """Notifica a un socio.

        La notificación pertenece al *usuario* del socio: acá se resuelve `socio.usuario_id`
        para que los services no confundan `socio.id` con `usuario.id`.
        """
        return self.notificar(
            session,
            NotificacionCreate(
                usuario_id=socio.usuario_id, tipo=tipo, titulo=titulo, cuerpo=cuerpo
            ),
        )

    def notificar(self, session: Session, datos: NotificacionCreate) -> Notificacion:
        """Genera la notificación y la dispara a los listeners del tipo.

        Regla de negocio: sólo se notifica a usuarios con perfil de **socio** (un
        empleado no debe recibir notificaciones de reservas/sanciones por error).
        """
        usuario = usuario_repo.get_by_id(session, datos.usuario_id, incluir_inactivos=True)
        if usuario is None:
            raise ValueError(f"usuario {datos.usuario_id} no existe")
        if usuario.socio is None:
            raise ValueError(f"el usuario {datos.usuario_id} no corresponde a un socio")

        notificacion = Notificacion(
            tipo=datos.tipo,
            titulo=datos.titulo,
            cuerpo=datos.cuerpo,
            usuario_id=datos.usuario_id,
        )
        self.events.notify(
            datos.tipo.value, NotificacionEvento(session, notificacion, usuario)
        )
        return notificacion


notificacion_service = NotificacionService()
