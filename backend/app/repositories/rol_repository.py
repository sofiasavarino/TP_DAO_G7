from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.rol import Rol
from app.repositories.base_repository import BaseRepository


class RolRepository(BaseRepository[Rol]):
    """Catalogo fijo de 3 roles (Socio, Bibliotecario, Administrador), cargado por seeds."""

    model = Rol

    def get_by_nombre(self, session: Session, nombre: str) -> Rol | None:
        """Busca sin importar mayusculas: "administrador" == "Administrador"."""
        stmt = select(Rol).where(func.lower(Rol.nombre) == nombre.lower())
        return session.scalars(stmt).first()
