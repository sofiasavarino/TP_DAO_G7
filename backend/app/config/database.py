from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///biblioteca.db"

# Un modulo se ejecuta una sola vez: engine y SessionLocal funcionan como singletons.
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine)


@event.listens_for(engine, "connect")
def activar_claves_foraneas(conexion, _):
    # SQLite trae las claves foraneas apagadas por defecto.
    cursor = conexion.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def crear_tablas() -> None:
    from app.models import Base  # importa todos los modelos

    Base.metadata.create_all(engine)
