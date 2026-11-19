import unicodedata
from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.config.settings import DATABASE_URL


def _unaccent(value: str | None) -> str | None:
    """UDF de SQLite: quita tildes/acentos (NFKD + filtra categoría Mn) y pasa a lower."""
    if value is None:
        return None
    return "".join(
        char
        for char in unicodedata.normalize("NFKD", value.lower())
        if unicodedata.category(char) != "Mn"
    )


def registrar_unaccent(engine):
    """Registra `unaccent` como función escalar UDF nativa de SQLite."""

    @event.listens_for(engine, "connect")
    def _registrar(dbapi_connection, _):
        dbapi_connection.create_function("unaccent", 1, _unaccent)


# Un modulo se ejecuta una sola vez: engine y SessionLocal funcionan como singletons.
engine = create_engine(DATABASE_URL, echo=False)
registrar_unaccent(engine)
SessionLocal = sessionmaker(bind=engine)


@event.listens_for(engine, "connect")
def activar_claves_foraneas(conexion, _):
    # SQLite trae las claves foraneas apagadas por defecto.
    cursor = conexion.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def get_session() -> Iterator:
    """Dependency de FastAPI: una sesión por request, cerrada al terminar."""
    with SessionLocal() as session:
        yield session


def crear_tablas() -> None:
    from app.models import Base  # importa todos los modelos

    Base.metadata.create_all(engine)
