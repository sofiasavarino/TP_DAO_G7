from collections.abc import Sequence
from datetime import date

from sqlalchemy import Row, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.ejemplar import Ejemplar
from app.models.enums import EstadoPrestamo, TipoPrestamo
from app.models.libro import Libro
from app.models.prestamo import Prestamo
from app.models.sancion import Sancion
from app.models.sede import Sede
from app.repositories.base_repository import BaseRepository

# "Abierto" = el socio todavia tiene el ejemplar (vencido o no).
ESTADOS_ABIERTOS = (EstadoPrestamo.ACTIVO, EstadoPrestamo.VENCIDO)


def _con_ejemplar_y_libro():
    """Opciones de carga para pantallas de prestamos: ejemplar -> libro y ejemplar -> sede."""
    return (
        selectinload(Prestamo.ejemplar).selectinload(Ejemplar.libro),
        selectinload(Prestamo.ejemplar).selectinload(Ejemplar.sede_actual),
    )


class PrestamoRepository(BaseRepository[Prestamo]):
    model = Prestamo

    def get_by_numero(self, session: Session, numero: str) -> Prestamo | None:
        return session.scalars(select(Prestamo).where(Prestamo.numero == numero)).first()

    def existe_numero(self, session: Session, numero: str) -> bool:
        return self.exists(session, Prestamo.numero == numero)

    def get_con_detalle(self, session: Session, prestamo_id: int) -> Prestamo | None:
        return self.get_by_id(
            session, prestamo_id, *_con_ejemplar_y_libro(), selectinload(Prestamo.socio)
        )

    def listar_por_socio(
        self,
        session: Session,
        socio_id: int,
        estados: Sequence[EstadoPrestamo] | None = None,
    ) -> list[Prestamo]:
        """"Mis prestamos": todos los del socio con ejemplar y libro, sin N+1."""
        stmt = select(Prestamo).where(Prestamo.socio_id == socio_id)
        if estados:
            stmt = stmt.where(Prestamo.estado.in_(estados))
        stmt = stmt.options(*_con_ejemplar_y_libro()).order_by(Prestamo.fecha_inicio.desc())
        return list(session.scalars(stmt))

    def listar(
        self,
        session: Session,
        estados: Sequence[EstadoPrestamo] | None = None,
        tipo: TipoPrestamo | None = None,
    ) -> list[Prestamo]:
        """Listado general del bibliotecario."""
        stmt = select(Prestamo)
        if estados:
            stmt = stmt.where(Prestamo.estado.in_(estados))
        if tipo is not None:
            stmt = stmt.where(Prestamo.tipo == tipo)
        stmt = stmt.options(*_con_ejemplar_y_libro(), selectinload(Prestamo.socio))
        return list(session.scalars(stmt.order_by(Prestamo.fecha_vencimiento)))

    def contar_abiertos_socio(self, session: Session, socio_id: int) -> int:
        """Para la regla del limite de prestamos: COUNT en la base, no len() en Python."""
        return self.count(
            session, Prestamo.socio_id == socio_id, Prestamo.estado.in_(ESTADOS_ABIERTOS)
        )

    def tiene_vencidos(self, session: Session, socio_id: int) -> bool:
        return self.exists(
            session, Prestamo.socio_id == socio_id, Prestamo.estado == EstadoPrestamo.VENCIDO
        )

    def get_abierto_de_ejemplar(self, session: Session, ejemplar_id: int) -> Prestamo | None:
        """El prestamo en curso de un ejemplar (para registrar la devolucion por codigo)."""
        stmt = select(Prestamo).where(
            Prestamo.ejemplar_id == ejemplar_id, Prestamo.estado.in_(ESTADOS_ABIERTOS)
        )
        return session.scalars(stmt).first()

    def listar_activos_vencidos_al(self, session: Session, fecha: date | None = None) -> list[Prestamo]:
        """Prestamos ACTIVO cuya fecha de vencimiento ya paso: el service los pasa a VENCIDO."""
        stmt = select(Prestamo).where(
            Prestamo.estado == EstadoPrestamo.ACTIVO,
            Prestamo.fecha_vencimiento < (fecha or date.today()),
        )
        return list(session.scalars(stmt.order_by(Prestamo.fecha_vencimiento)))

    def listar_vencidos_sin_sancion(self, session: Session) -> list[Prestamo]:
        """VENCIDOS que todavia no tienen sancion (NOT EXISTS, una sola query)."""
        tiene_sancion = select(Sancion.id).where(Sancion.prestamo_id == Prestamo.id).exists()
        stmt = (
            select(Prestamo)
            .where(Prestamo.estado == EstadoPrestamo.VENCIDO, ~tiene_sancion)
            .options(*_con_ejemplar_y_libro(), selectinload(Prestamo.socio))
            .order_by(Prestamo.fecha_vencimiento)
        )
        return list(session.scalars(stmt))

    def proximas_devoluciones_de_libro(self, session: Session, libro_id: int) -> list[Prestamo]:
        """Prestamos abiertos de cualquier ejemplar del libro, ordenados por vencimiento.
        Insumo para calcular_eta() del service de reservas."""
        stmt = (
            select(Prestamo)
            .join(Prestamo.ejemplar)
            .where(Ejemplar.libro_id == libro_id, Prestamo.estado.in_(ESTADOS_ABIERTOS))
            .options(selectinload(Prestamo.ejemplar))
            .order_by(Prestamo.fecha_vencimiento)
        )
        return list(session.scalars(stmt))

    # ---------------------------------------------------------------- reportes

    def conteo_por_estado_y_tipo(
        self, session: Session
    ) -> list[Row[tuple[EstadoPrestamo, TipoPrestamo, int]]]:
        """Reporte "prestamos activos / vencidos": filas (estado, tipo, cantidad)."""
        stmt = (
            select(Prestamo.estado, Prestamo.tipo, func.count(Prestamo.id).label("cantidad"))
            .group_by(Prestamo.estado, Prestamo.tipo)
            .order_by(Prestamo.estado, Prestamo.tipo)
        )
        return list(session.execute(stmt).all())

    def activos_por_sede(self, session: Session) -> list[Row]:
        """Préstamos ACTIVOS por sede actual del ejemplar (carga operativa)."""
        stmt = (
            select(
                Sede.id.label("sede_id"),
                Sede.nombre.label("sede"),
                func.count(Prestamo.id).label("prestamos"),
            )
            .join(Ejemplar, Prestamo.ejemplar_id == Ejemplar.id)
            .join(Sede, Ejemplar.sede_actual_id == Sede.id)
            .where(Prestamo.estado == EstadoPrestamo.ACTIVO)
            .group_by(Sede.id, Sede.nombre)
            .order_by(Sede.nombre)
        )
        return list(session.execute(stmt).all())

    def por_genero_y_sede(
        self, session: Session, desde: date | None = None, hasta: date | None = None
    ) -> list[Row]:
        """Préstamos agrupados por género del libro y sede actual (rotación de catálogo)."""
        stmt = (
            select(
                Libro.genero.label("genero"),
                Sede.nombre.label("sede"),
                func.count(Prestamo.id).label("prestamos"),
            )
            .join(Ejemplar, Prestamo.ejemplar_id == Ejemplar.id)
            .join(Libro, Ejemplar.libro_id == Libro.id)
            .join(Sede, Ejemplar.sede_actual_id == Sede.id)
            .where(Libro.genero.is_not(None))
            .group_by(Libro.genero, Sede.nombre)
            .order_by(func.count(Prestamo.id).desc())
        )
        if desde is not None:
            stmt = stmt.where(Prestamo.fecha_inicio >= desde)
        if hasta is not None:
            stmt = stmt.where(Prestamo.fecha_inicio <= hasta)
        return list(session.execute(stmt).all())
