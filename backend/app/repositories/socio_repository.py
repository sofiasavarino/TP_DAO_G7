from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.enums import EstadoSocio
from app.models.socio import Socio
from app.repositories.base_repository import BaseRepository
from app.utils.texto import unaccent


class SocioRepository(BaseRepository[Socio]):
    """Socio no tiene columna `activo`: la baja es `estado = BAJA`.
    Por eso redefine los dos ganchos de la base."""

    model = Socio

    def _condicion_activo(self) -> ColumnElement[bool]:
        # SUSPENDIDO sigue apareciendo en los listados (es socio, solo que no puede pedir).
        return Socio.estado != EstadoSocio.BAJA

    def _marcar_baja(self, obj: Socio) -> None:
        obj.estado = EstadoSocio.BAJA

    def get_by_dni(self, session: Session, dni: str) -> Socio | None:
        stmt = select(Socio).where(Socio.dni == dni.strip())
        return session.scalars(stmt).first()

    def existe_dni(self, session: Session, dni: str, excluir_id: int | None = None) -> bool:
        """Evita socios duplicados (incluye los dados de baja)."""
        filtros = [Socio.dni == dni.strip()]
        if excluir_id is not None:
            filtros.append(Socio.id != excluir_id)
        return self.exists(session, *filtros)

    def existe_email(self, session: Session, email: str) -> bool:
        """Un email por socio (incluye los dados de baja)."""
        return self.exists(session, func.lower(Socio.email) == email.strip().lower())

    def get_by_usuario_id(self, session: Session, usuario_id: int) -> Socio | None:
        """El socio logueado: el token trae el usuario, de ahi se saca el socio."""
        stmt = select(Socio).where(Socio.usuario_id == usuario_id)
        return session.scalars(stmt).first()

    def buscar(self, session: Session, texto: str) -> list[Socio]:
        """Busqueda por nombre, apellido o DNI (pantalla del bibliotecario)."""
        patron = f"%{unaccent(texto)}%"
        stmt = (
            self._select()
            .where(
                or_(
                    func.unaccent(Socio.nombre).ilike(patron),
                    func.unaccent(Socio.apellido).ilike(patron),
                    Socio.dni.ilike(patron),
                )
            )
            .order_by(Socio.apellido, Socio.nombre)
        )
        return list(session.scalars(stmt))

    def listar_por_estado(self, session: Session, estado: EstadoSocio) -> list[Socio]:
        stmt = select(Socio).where(Socio.estado == estado).order_by(Socio.apellido)
        return list(session.scalars(stmt))

    def get_con_usuario(self, session: Session, socio_id: int) -> Socio | None:
        return self.get_by_id(session, socio_id, selectinload(Socio.usuario))
