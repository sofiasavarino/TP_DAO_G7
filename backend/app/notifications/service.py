"""Publisher concreto (el "Editor" del ejemplo): genera eventos de notificación.

Valida el usuario, crea la `Notificacion` y dispara `events.notify(tipo, evento)`;
los listeners suscriptos (por tipo de evento) hacen el resto.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.dtos.notificacion_dto import NotificacionCreate, NotificacionDTO
from app.models.enums import NotificacionTipo
from app.models.notificacion import Notificacion
from app.models.socio import Socio
from app.repositories.notificacion_repository import NotificacionRepository
from app.repositories.usuario_repository import UsuarioRepository
from app.notifications.event_manager import EventManager
from app.notifications.listeners import (
    EventListener,
    MailListener,
    NotificacionEvento,
    PersistirListener,
)

usuario_repo = UsuarioRepository()
notificacion_repo = NotificacionRepository()


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

    # ------------------------------------------------------------------ consultas

    def _validar_usuario(self, session: Session, usuario_id: int) -> None:
        if usuario_repo.get_by_id(session, usuario_id, incluir_inactivos=True) is None:
            raise ValueError(f"usuario {usuario_id} no existe")

    def listar_historial(self, session: Session, usuario_id: int) -> list[NotificacionDTO]:
        """Todas las notificaciones del usuario, de la más nueva a la más vieja."""
        self._validar_usuario(session, usuario_id)
        return [
            NotificacionDTO.model_validate(n)
            for n in notificacion_repo.listar_por_usuario(session, usuario_id)
        ]

    def listar_no_leidas(self, session: Session, usuario_id: int) -> list[NotificacionDTO]:
        """Solo las no leídas (bandeja)."""
        self._validar_usuario(session, usuario_id)
        return [
            NotificacionDTO.model_validate(n)
            for n in notificacion_repo.listar_por_usuario(session, usuario_id, solo_no_leidas=True)
        ]

    def contar_no_leidas(self, session: Session, usuario_id: int) -> int:
        """Para el globito de la campanita del frontend."""
        self._validar_usuario(session, usuario_id)
        return notificacion_repo.contar_no_leidas(session, usuario_id)

    def marcar_leida(self, session: Session, notificacion_id: int, usuario_id: int) -> Notificacion:
        """Marca una notificación como leída. Valida que exista y sea del usuario."""
        notificacion = notificacion_repo.get_by_id(session, notificacion_id)
        if notificacion is None:
            raise ValueError(f"notificación {notificacion_id} no existe")
        if notificacion.usuario_id != usuario_id:
            raise ValueError(
                f"la notificación {notificacion_id} no pertenece al usuario {usuario_id}"
            )
        notificacion_repo.marcar_leida(session, notificacion_id)
        return notificacion

    def notificar_a_usuario(
        self, session: Session, usuario: Usuario, tipo: NotificacionTipo, titulo: str, cuerpo: str
    ) -> Notificacion:
        """Notifica a cualquier usuario (socio o bibliotecario: p. ej. reset de contraseña)."""
        return self._notificar(session, usuario, tipo, titulo, cuerpo)

    def notificar_a_socio(
        self, session: Session, socio: Socio, tipo: NotificacionTipo, titulo: str, cuerpo: str
    ) -> Notificacion:
        """Notifica a un socio.

        La notificación pertenece al *usuario* del socio: acá se resuelve `socio.usuario_id`
        para que los services no confundan `socio.id` con `usuario.id`.
        """
        return self._notificar(session, socio.usuario, tipo, titulo, cuerpo)

    def notificar(self, session: Session, datos: NotificacionCreate) -> Notificacion:
        """Genera la notificación y la dispara a los listeners del tipo.

        Regla de negocio: sólo se notifica a usuarios con perfil de **socio** (un
        empleado no debe recibir notificaciones de reservas/sanciones por error).
        Para avisos de cuenta (contraseña) usar `notificar_a_usuario`.
        """
        usuario = usuario_repo.get_by_id(session, datos.usuario_id, incluir_inactivos=True)
        if usuario is None:
            raise ValueError(f"usuario {datos.usuario_id} no existe")
        if usuario.socio is None:
            raise ValueError(f"el usuario {datos.usuario_id} no corresponde a un socio")

        return self._notificar(session, usuario, datos.tipo, datos.titulo, datos.cuerpo)

    def _notificar(
        self, session: Session, usuario: Usuario, tipo: NotificacionTipo, titulo: str, cuerpo: str
    ) -> Notificacion:
        notificacion = Notificacion(
            tipo=tipo,
            titulo=titulo,
            cuerpo=cuerpo,
            usuario_id=usuario.id,
        )
        self.events.notify(tipo.value, NotificacionEvento(session, notificacion, usuario))
        return notificacion


notificacion_service = NotificacionService()
