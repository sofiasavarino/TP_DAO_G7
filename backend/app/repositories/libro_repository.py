from sqlalchemy import Row, exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.autor import Autor
from app.models.ejemplar import Ejemplar
from app.models.enums import EstadoEjemplar, TipoPrestamo
from app.models.libro import Libro
from app.models.prestamo import Prestamo
from app.utils.texto import unaccent
from app.repositories.base_repository import BaseRepository


class LibroRepository(BaseRepository[Libro]):
    model = Libro

    def get_con_detalle(self, session: Session, libro_id: int) -> Libro | None:
        """Ficha del libro: autores y ejemplares (con su sede actual) precargados."""
        return self.get_by_id(
            session,
            libro_id,
            selectinload(Libro.autores),
            selectinload(Libro.ejemplares).selectinload(Ejemplar.sede_actual),
        )

    def get_by_isbn(self, session: Session, isbn: str) -> Libro | None:
        return session.scalars(select(Libro).where(Libro.isbn == isbn)).one_or_none()

    def existe_isbn(self, session: Session, isbn: str, excluir_id: int | None = None) -> bool:
        """Evita duplicados en el catalogo (alta manual o importacion de Google Books)."""
        filtros = [Libro.isbn == isbn.strip()]
        if excluir_id is not None:
            filtros.append(Libro.id != excluir_id)
        return self.exists(session, *filtros)

    def listar_catalogo_filtrado(
        self,
        session: Session,
        *,
        titulo: str | None = None,
        isbn: str | None = None,
        autor: str | None = None,
        genero: str | None = None,
        sedes: list[int] | None = None,
        orden: str = "default",
    ) -> list[Libro]:
        """Busqueda compuesta del catalogo. Todos los filtros son AND; `sedes` aplica
        EXISTS (al menos una copia DISPONIBLE en una de las sedes seleccionadas)."""
        stmt = (
            select(Libro)
            .options(selectinload(Libro.autores))
            .where(Libro.activo.is_(True))  # los dados de baja no aparecen en el catálogo
        )

        if titulo:
            stmt = stmt.where(func.unaccent(Libro.nombre).ilike(f"%{unaccent(titulo)}%"))

        if isbn:
            # ISBN es numérico: no hace falta quitar tildes.
            stmt = stmt.where(Libro.isbn.ilike(f"%{isbn.strip()}%"))

        if autor:
            stmt = stmt.outerjoin(Libro.autores).where(
                func.unaccent(Autor.nombre).ilike(f"%{unaccent(autor)}%")
            ).distinct()

        if genero:
            stmt = stmt.where(Libro.genero == genero.strip())

        if sedes:
            existe_disponible = (
                select(Ejemplar.id)
                .where(
                    Ejemplar.libro_id == Libro.id,
                    Ejemplar.estado == EstadoEjemplar.DISPONIBLE,
                    Ejemplar.sede_actual_id.in_(sedes),
                )
                .exists()
            )
            stmt = stmt.where(existe_disponible)

        if orden == "populares":
            popularidad = (
                select(Ejemplar.libro_id, func.count(Prestamo.id).label("n"))
                .join(Prestamo, Prestamo.ejemplar_id == Ejemplar.id)
                .group_by(Ejemplar.libro_id)
                .subquery()
            )
            stmt = stmt.outerjoin(popularidad, popularidad.c.libro_id == Libro.id).order_by(
                func.coalesce(popularidad.c.n, 0).desc(), Libro.nombre
            )
        elif orden == "recientes":
            stmt = stmt.order_by(Libro.fecha_publicacion.desc())
        else:
            stmt = stmt.order_by(Libro.nombre)

        return list(session.scalars(stmt))

    # ---------------------------------------------------------------- reportes

    def mas_solicitados(
        self,
        session: Session,
        tipo: TipoPrestamo | None = TipoPrestamo.INTERBIBLIOTECARIO,
        limite: int = 10,
    ) -> list[Row[tuple[int, str, int]]]:
        """Reporte "libros mas solicitados para prestamos inter-sedes".
        Devuelve filas (libro_id, nombre, cantidad). Con `tipo=None` cuenta todos."""
        cantidad = func.count(Prestamo.id).label("cantidad")
        stmt = (
            select(Libro.id, Libro.nombre, cantidad)
            .join(Ejemplar, Ejemplar.libro_id == Libro.id)
            .join(Prestamo, Prestamo.ejemplar_id == Ejemplar.id)
            .group_by(Libro.id, Libro.nombre)
            .order_by(cantidad.desc(), Libro.nombre)
            .limit(limite)
        )
        if tipo is not None:
            stmt = stmt.where(Prestamo.tipo == tipo)
        return list(session.execute(stmt).all())
