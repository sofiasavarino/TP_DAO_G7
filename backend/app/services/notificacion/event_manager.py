"""Publisher base del patrón Observer.

Mantiene un mapa de tipos de evento → listeners y los notifica. Un listener que
falla no rompe el broadcast (se loguea y se sigue con los demás): el mail nunca
debe impedir que la notificación se persista.
"""

from collections import defaultdict
import logging
from typing import Any

logger = logging.getLogger(__name__)


class EventManager:
    """Base publisher: suscripción management + notificación."""

    def __init__(self) -> None:
        self._listeners: dict[str, list] = defaultdict(list)

    def subscribe(self, event_type: str, listener) -> None:
        if listener not in self._listeners[event_type]:
            self._listeners[event_type].append(listener)

    def unsubscribe(self, event_type: str, listener) -> None:
        self._listeners[event_type] = [
            l for l in self._listeners[event_type] if l is not listener
        ]

    def notify(self, event_type: str, data: Any) -> None:
        """Notifica a los listeners del tipo, en dos tandas:

        1. Críticos (`critico=True`) corren primero y SIN capturar excepciones: si uno
           falla, el broadcast se detiene (la excepción propaga) y los no-críticos no
           corren. Así, por ejemplo, MailListener nunca manda un mail por una
           notificación que no se llegó a persistir.
        2. No-críticos corren aislados: un fallo se loguea y los demás siguen.
        """
        listeners = list(self._listeners.get(event_type, []))
        for listener in [l for l in listeners if getattr(l, "critico", False)]:
            listener.update(data)
        for listener in [l for l in listeners if not getattr(l, "critico", False)]:
            try:
                listener.update(data)
            except Exception as e:  # noqa: BLE001 — un listener no rompe el broadcast
                logger.warning(
                    "listener %s falló en evento %s: %s", type(listener).__name__, event_type, e
                )
