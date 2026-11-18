from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config.database import registrar_unaccent
from app.config.database import get_session
from app.main import app
from app.models import Base


@pytest.fixture
def session(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path}/test.db",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    registrar_unaccent(engine)
    Base.metadata.create_all(engine)

    @event.listens_for(engine, "connect")
    def _fks(conn, _rec):
        conn.execute("PRAGMA foreign_keys=ON")

    SessionT = sessionmaker(bind=engine, expire_on_commit=False)
    with SessionT() as s:
        yield s
    engine.dispose()


@pytest.fixture
def client(session) -> Iterator[TestClient]:
    def _override() -> Iterator:
        yield session

    app.dependency_overrides[get_session] = _override
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
