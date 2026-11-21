"""Acciones que se ejecutan recién cuando la transacción se confirma.

Sirve para efectos que no se pueden deshacer (mandar un mail): se encolan en la sesión
con `despues_del_commit(session, accion)` y corren cuando la sesión hace `commit()`.
Si la transacción se revierte, se descartan y nunca se ejecutan.

No hace falta saber quién abre o confirma la transacción (`SessionLocal.begin()`,
`session.commit()` a mano, etc.): los eventos se registran sobre la clase `Session`.

Ojo: en `after_commit` la sesión ya no tiene transacción activa y no puede emitir SQL.
Por eso la `accion` tiene que ser autosuficiente: capturar valores simples (str, int)
y no objetos del ORM, que a esa altura están expirados y harían consultas.
"""

import logging
from collections.abc import Callable

from sqlalchemy import event
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_CLAVE = "acciones_post_commit"


def despues_del_commit(session: Session, accion: Callable[[], None]) -> None:
    """Encola `accion` para ejecutarla cuando `session` haga commit."""
    session.info.setdefault(_CLAVE, []).append(accion)


@event.listens_for(Session, "after_commit")
def _ejecutar_acciones(session: Session) -> None:
    for accion in session.info.pop(_CLAVE, []):
        try:
            accion()
        except Exception:  # noqa: BLE001 — el commit ya ocurrió: un fallo no puede deshacerlo
            logger.exception("falló una acción post-commit")


@event.listens_for(Session, "after_rollback")
def _descartar_acciones(session: Session) -> None:
    session.info.pop(_CLAVE, None)
