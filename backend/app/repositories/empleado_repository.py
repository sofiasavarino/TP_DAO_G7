from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models.empleado import Empleado
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.repositories.base_repository import BaseRepository


class EmpleadoRepository(BaseRepository[Empleado]):
    """Empleado usa la columna `activo` (BajaLogicaMixin)."""

    model = Empleado

    def existe_email(self, session: Session, email: str) -> bool:
        return self.exists(session, func.lower(Empleado.email) == email.strip().lower())

    def existe_legajo(self, session: Session, legajo: str) -> bool:
        return self.exists(session, func.lower(Empleado.legajo) == legajo.strip().lower())

    def listar_por_rol(self, session: Session, rol_nombre: str) -> list[Empleado]:
        """Personal con ese rol (activos e inactivos), con usuario y sede precargados."""
        stmt = (
            self._select(incluir_inactivos=True)
            .join(Empleado.usuario)
            .join(Usuario.rol)
            .where(Rol.nombre == rol_nombre)
            .options(selectinload(Empleado.usuario).selectinload(Usuario.sede))
            .order_by(Empleado.apellido, Empleado.nombre)
        )
        return list(session.scalars(stmt))
