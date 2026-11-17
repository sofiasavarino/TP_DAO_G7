from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.sede import Sede
from app.repositories.base_repository import BaseRepository


class SedeRepository(BaseRepository[Sede]):
    """Sede usa la columna `activo`: list_activos y get_by_id ya filtran las dadas de baja."""

    model = Sede

    def get_by_nombre(self, session: Session, nombre: str) -> Sede | None:
        stmt = select(Sede).where(func.lower(Sede.nombre) == nombre.strip().lower())
        return session.scalars(stmt).first()

    def existe_nombre(self, session: Session, nombre: str, excluir_id: int | None = None) -> bool:
        """Para evitar sedes duplicadas. `excluir_id` sirve al editar (que no choque consigo misma)."""
        filtros = [func.lower(Sede.nombre) == nombre.strip().lower()]
        if excluir_id is not None:
            filtros.append(Sede.id != excluir_id)
        return self.exists(session, *filtros)

    def esta_activa(self, session: Session, sede_id: int) -> bool:
        """Validacion: no se inician prestamos, reservas ni envios desde/hacia una sede de baja."""
        return self.exists(session, Sede.id == sede_id, solo_activos=True)
