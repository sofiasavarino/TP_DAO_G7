from sqlalchemy import select, update
from sqlalchemy.orm import Session
from typing import Any, cast

from sqlalchemy import select, update
from sqlalchemy.engine import CursorResult
from app.models.notificacion import Notificacion
from app.repositories.base_repository import BaseRepository


class NotificacionRepository(BaseRepository[Notificacion]):
    model = Notificacion

    def listar_por_usuario(
        self, session: Session, usuario_id: int, solo_no_leidas: bool = False
    ) -> list[Notificacion]:
        """Historial del usuario, de la mas nueva a la mas vieja."""
        stmt = select(Notificacion).where(Notificacion.usuario_id == usuario_id)
        if solo_no_leidas:
            stmt = stmt.where(Notificacion.leida.is_(False))
        stmt = stmt.order_by(Notificacion.fecha_creacion.desc(), Notificacion.id.desc())
        return list(session.scalars(stmt))

    def contar_no_leidas(self, session: Session, usuario_id: int) -> int:
        """Para el globito de la campanita en el frontend."""
        return self.count(
            session,
            Notificacion.usuario_id == usuario_id,
            Notificacion.leida.is_(False),
        )

    def marcar_todas_leidas(self, session: Session, usuario_id: int) -> int:
        """UPDATE masivo (una sola sentencia). Devuelve cuantas filas cambio."""
        stmt = (
            update(Notificacion)
            .where(Notificacion.usuario_id == usuario_id, Notificacion.leida.is_(False))
            .values(leida=True)
        )
        resultado = cast(CursorResult[Any], session.execute(stmt))
        return resultado.rowcount or 0

    def marcar_leida(self, session: Session, notificacion_id: int) -> Notificacion | None:
        """Marca UNA notificación como leída (si ya estaba, no toca nada)."""
        notificacion = self.get_by_id(session, notificacion_id)
        if notificacion is None or notificacion.leida:
            return notificacion
        notificacion.leida = True
        session.flush()
        return notificacion
