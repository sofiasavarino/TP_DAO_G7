from sqlalchemy import Row, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.ejemplar import Ejemplar
from app.models.enums import EstadoEjemplar
from app.models.libro import Libro
from app.models.sede import Sede
from app.repositories.base_repository import BaseRepository


class EjemplarRepository(BaseRepository[Ejemplar]):
    """Ejemplar no tiene baja logica: un ejemplar roto queda en estado INUTILIZABLE."""

    model = Ejemplar

    def get_by_codigo(self, session: Session, codigo_inventario: str) -> Ejemplar | None:
        stmt = select(Ejemplar).where(Ejemplar.codigo_inventario == codigo_inventario.strip())
        return session.scalars(stmt).first()

    def existe_codigo(self, session: Session, codigo_inventario: str) -> bool:
        """Evita ejemplares duplicados."""
        return self.exists(session, Ejemplar.codigo_inventario == codigo_inventario.strip())

    def get_con_detalle(self, session: Session, ejemplar_id: int) -> Ejemplar | None:
        return self.get_by_id(
            session,
            ejemplar_id,
            selectinload(Ejemplar.libro),
            selectinload(Ejemplar.sede_actual),
            selectinload(Ejemplar.sede_origen),
        )

    def get_by_ids(self, session: Session, ids: list[int]) -> list[Ejemplar]:
        """Para armar un remito con varios ejemplares en una sola query."""
        if not ids:
            return []
        return list(session.scalars(select(Ejemplar).where(Ejemplar.id.in_(ids))))

    def listar_por_libro(self, session: Session, libro_id: int) -> list[Ejemplar]:
        stmt = (
            select(Ejemplar)
            .where(Ejemplar.libro_id == libro_id)
            .options(selectinload(Ejemplar.sede_actual))
            .order_by(Ejemplar.codigo_inventario)
        )
        return list(session.scalars(stmt))

    def listar_inventario(
        self,
        session: Session,
        *,
        libro_id: int | None = None,
        sede_id: int | None = None,
        estado: EstadoEjemplar | None = None,
    ) -> list[Ejemplar]:
        """Inventario físico (todos los estados) filtrable por libro, sede ACTUAL y estado.
        Trae libro y sedes precargados; ordena por título y código."""
        stmt = (
            select(Ejemplar)
            .join(Ejemplar.libro)
            .options(
                selectinload(Ejemplar.libro),
                selectinload(Ejemplar.sede_actual),
                selectinload(Ejemplar.sede_origen),
            )
        )
        if libro_id is not None:
            stmt = stmt.where(Ejemplar.libro_id == libro_id)
        if sede_id is not None:
            stmt = stmt.where(Ejemplar.sede_actual_id == sede_id)
        if estado is not None:
            stmt = stmt.where(Ejemplar.estado == estado)
        return list(session.scalars(stmt.order_by(Libro.nombre, Ejemplar.codigo_inventario)))

    def listar_disponibles(
        self,
        session: Session,
        libro_id: int | None = None,
        sede_id: int | None = None,
    ) -> list[Ejemplar]:
        """Consulta de disponibilidad. Filtra por libro y/o por sede ACTUAL
        (inventario flotante: el ejemplar esta donde se devolvio)."""
        stmt = select(Ejemplar).where(Ejemplar.estado == EstadoEjemplar.DISPONIBLE)
        if libro_id is not None:
            stmt = stmt.where(Ejemplar.libro_id == libro_id)
        if sede_id is not None:
            stmt = stmt.where(Ejemplar.sede_actual_id == sede_id)
        stmt = stmt.options(
            selectinload(Ejemplar.libro), selectinload(Ejemplar.sede_actual)
        ).order_by(Ejemplar.id)
        return list(session.scalars(stmt))

    def primer_disponible(
        self, session: Session, libro_id: int, sede_id: int | None = None
    ) -> Ejemplar | None:
        """Un ejemplar DISPONIBLE del libro (en la sede indicada si se pasa).
        Lo usa el service de reservas para asignar."""
        stmt = select(Ejemplar).where(
            Ejemplar.libro_id == libro_id,
            Ejemplar.estado == EstadoEjemplar.DISPONIBLE,
        )
        if sede_id is not None:
            stmt = stmt.where(Ejemplar.sede_actual_id == sede_id)
        return session.scalars(stmt.order_by(Ejemplar.id).limit(1)).first()

    def listar_por_estado(
        self, session: Session, estado: EstadoEjemplar, sede_id: int | None = None
    ) -> list[Ejemplar]:
        """P. ej. material EN_TRANSITO, o EN_REPARACION de una sede."""
        stmt = select(Ejemplar).where(Ejemplar.estado == estado)
        if sede_id is not None:
            stmt = stmt.where(Ejemplar.sede_actual_id == sede_id)
        stmt = stmt.options(selectinload(Ejemplar.libro), selectinload(Ejemplar.sede_actual))
        return list(session.scalars(stmt.order_by(Ejemplar.id)))

    def contar_por_estado(self, session: Session, estado: EstadoEjemplar) -> int:
        return self.count(session, Ejemplar.estado == estado)

    # ---------------------------------------------------------------- reportes

    def disponibilidad_por_sede(
        self, session: Session, libro_id: int | None = None
    ) -> list[Row[tuple[int, str, int, int]]]:
        """Reporte "disponibilidad de catalogo por sede".
        Filas (sede_id, sede_nombre, disponibles, total_ejemplares)."""
        disponibles = func.count(Ejemplar.id).filter(
            Ejemplar.estado == EstadoEjemplar.DISPONIBLE
        )
        stmt = (
            select(
                Sede.id,
                Sede.nombre,
                disponibles.label("disponibles"),
                func.count(Ejemplar.id).label("total"),
            )
            .join(Ejemplar, Ejemplar.sede_actual_id == Sede.id)
            .where(Ejemplar.estado != EstadoEjemplar.INUTILIZABLE)
            .group_by(Sede.id, Sede.nombre)
            .order_by(Sede.nombre)
        )
        if libro_id is not None:
            stmt = stmt.where(Ejemplar.libro_id == libro_id)
        return list(session.execute(stmt).all())

    def conteo_por_estado(self, session: Session) -> dict[EstadoEjemplar, int]:
        """Cuantos ejemplares hay en cada estado (sirve para "material en transito")."""
        stmt = select(Ejemplar.estado, func.count(Ejemplar.id)).group_by(Ejemplar.estado)
        return {estado: cantidad for estado, cantidad in session.execute(stmt)}
