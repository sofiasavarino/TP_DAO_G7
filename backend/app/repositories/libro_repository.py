from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.libro import Libro


def get_by_isbn(session: Session, isbn: str) -> Libro | None:
    return session.scalars(select(Libro).where(Libro.isbn == isbn)).one_or_none()
