from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.autor import Autor
from app.repositories.base_repository import BaseRepository
from app.utils.texto import unaccent


class AutorRepository(BaseRepository[Autor]):
    model = Autor

    def get_by_nombre(self, session: Session, nombre: str) -> Autor | None:
        """Para no duplicar autores al importar de Google Books (compara sin mayusculas)."""
        stmt = select(Autor).where(func.lower(Autor.nombre) == nombre.strip().lower())
        return session.scalars(stmt).first()

    def get_by_nombres(self, session: Session, nombres: list[str]) -> list[Autor]:
        """Todos los autores existentes de una lista de nombres, en una sola query."""
        if not nombres:
            return []
        normalizados = [n.strip().lower() for n in nombres]
        stmt = select(Autor).where(func.lower(Autor.nombre).in_(normalizados))
        return list(session.scalars(stmt))

    def get_by_ids(self, session: Session, ids: list[int]) -> list[Autor]:
        if not ids:
            return []
        return list(session.scalars(select(Autor).where(Autor.id.in_(ids))))

    def buscar(self, session: Session, texto: str) -> list[Autor]:
        stmt = (
            select(Autor)
            .where(func.unaccent(Autor.nombre).ilike(f"%{unaccent(texto)}%"))
            .order_by(Autor.nombre)
        )
        return list(session.scalars(stmt))
