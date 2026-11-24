"""Fixtures compartidas por toda la suite.

- `session`: SQLite EN MEMORIA creada al vuelo para cada test (create_all) y destruida
  al terminar (drop_all). StaticPool hace que todas las conexiones compartan la misma
  base en memoria (si no, cada conexión vería una base vacía distinta).
- `client`: `TestClient` de la app FastAPI con `get_session` reemplazada por la sesión
  del test, así los endpoints ven los mismos datos que inserta el test.
- `fabrica`: atajos para insertar datos mínimos (sede, socio, libro, ejemplar...).
- `token_de`: arma el header `Authorization: Bearer ...` para un usuario.
"""

import os

# Antes de importar `app`: settings lee el entorno al importarse.
# - JWT_SECRET fijo para poder firmar/verificar tokens en los tests de API.
# - EMAIL_BACKEND=console: nunca se intenta SMTP real.
# - DATABASE_URL en memoria: la app nunca toca `biblioteca.db` aunque algo se escape
#   del dependency override.
os.environ["JWT_SECRET"] = "clave-solo-para-tests-no-usar-en-prod"
os.environ["EMAIL_BACKEND"] = "console"
os.environ["DATABASE_URL"] = "sqlite://"

from collections.abc import Iterator  # noqa: E402
from datetime import date, timedelta  # noqa: E402
from itertools import count  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.config.database import get_session, registrar_unaccent  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from app.models.ejemplar import Ejemplar  # noqa: E402
from app.models.enums import (  # noqa: E402
    EstadoEjemplar,
    EstadoPrestamo,
    EstadoReserva,
    EstadoSocio,
    TipoPrestamo,
)
from app.models.libro import Libro  # noqa: E402
from app.models.prestamo import Prestamo  # noqa: E402
from app.models.reserva import Reserva  # noqa: E402
from app.models.rol import Rol  # noqa: E402
from app.models.sede import Sede  # noqa: E402
from app.models.socio import Socio  # noqa: E402
from app.models.usuario import Usuario  # noqa: E402


# ---------------------------------------------------------------------------- base


@pytest.fixture
def engine():
    engine = create_engine(
        "sqlite://",  # en memoria
        connect_args={"check_same_thread": False},  # TestClient corre en otro hilo
        poolclass=StaticPool,
    )
    registrar_unaccent(engine)

    # Igual que en producción: SQLite trae las FK apagadas. Se registra ANTES de
    # create_all para que corra en la (única) conexión del StaticPool.
    @event.listens_for(engine, "connect")
    def _fks(dbapi_conn, _rec):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def session(engine) -> Iterator[Session]:
    SessionT = sessionmaker(bind=engine, expire_on_commit=False)
    with SessionT() as s:
        yield s


@pytest.fixture
def client(session) -> Iterator[TestClient]:
    def _override() -> Iterator[Session]:
        yield session

    app.dependency_overrides[get_session] = _override
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------------ fábrica


class Fabrica:
    """Inserta datos mínimos y válidos (con FK reales). Cada método hace flush y
    devuelve el objeto ya con `id`. Los valores únicos (dni, códigos, usuarios) se
    generan con un contador para que se puedan crear varios en el mismo test."""

    def __init__(self, session: Session) -> None:
        self.s = session
        self._n = count(1)

    def _sig(self) -> int:
        return next(self._n)

    def _guardar(self, obj):
        self.s.add(obj)
        self.s.flush()
        return obj

    def rol(self, nombre: str) -> Rol:
        existente = self.s.query(Rol).filter_by(nombre=nombre).first()
        return existente or self._guardar(Rol(nombre=nombre, descripcion=nombre))

    def sede(self, nombre: str | None = None) -> Sede:
        n = self._sig()
        return self._guardar(Sede(nombre=nombre or f"Sede {n}", direccion=f"Calle {n}"))

    def usuario(
        self,
        rol: str = "Bibliotecario",
        sede: Sede | None = None,
        nombre_usuario: str | None = None,
        password: str | None = None,
    ) -> Usuario:
        n = self._sig()
        if password is not None:
            from app.utils.security import hash_password

            hash_ = hash_password(password)
        else:
            hash_ = "x"  # no se loguea; ahorra el costo de argon2
        return self._guardar(
            Usuario(
                nombre_usuario=nombre_usuario or f"usuario{n}",
                email=f"usuario{n}@test.com",
                hash=hash_,
                rol_id=self.rol(rol).id,
                sede_id=(sede or self.sede()).id,
            )
        )

    def socio(self, sede: Sede | None = None, estado: EstadoSocio = EstadoSocio.ACTIVO) -> Socio:
        n = self._sig()
        usuario = self.usuario(rol="Socio", sede=sede)
        return self._guardar(
            Socio(
                nombre=f"Socio{n}", apellido="Test", dni=f"{30000000 + n}",
                estado=estado, usuario_id=usuario.id,
            )
        )

    def libro(self, nombre: str | None = None) -> Libro:
        n = self._sig()
        return self._guardar(Libro(nombre=nombre or f"Libro {n}", isbn=f"{9780000000000 + n}"))

    def ejemplar(
        self, libro: Libro, sede: Sede, estado: EstadoEjemplar = EstadoEjemplar.DISPONIBLE
    ) -> Ejemplar:
        n = self._sig()
        return self._guardar(
            Ejemplar(
                codigo_inventario=f"E-{n:04d}", estado=estado, libro_id=libro.id,
                sede_origen_id=sede.id, sede_actual_id=sede.id,
            )
        )

    def prestamo(
        self,
        socio: Socio,
        ejemplar: Ejemplar,
        fecha_vencimiento: date | None = None,
        estado: EstadoPrestamo = EstadoPrestamo.ACTIVO,
    ) -> Prestamo:
        """Préstamo insertado a mano (sin pasar por el service), p. ej. para simular
        uno vencido. El ejemplar debería venir PRESTADO si el préstamo está abierto."""
        n = self._sig()
        hoy = date.today()
        return self._guardar(
            Prestamo(
                numero=f"PT-{n:05d}", tipo=TipoPrestamo.LOCAL, estado=estado,
                fecha_inicio=hoy - timedelta(days=15),
                fecha_vencimiento=fecha_vencimiento or hoy + timedelta(days=15),
                socio_id=socio.id, ejemplar_id=ejemplar.id,
            )
        )

    def reserva(
        self,
        socio: Socio,
        libro: Libro,
        sede_retiro: Sede,
        fecha_reserva: date | None = None,
        estado: EstadoReserva = EstadoReserva.PENDIENTE,
        ejemplar: Ejemplar | None = None,
        fecha_vencimiento_retiro: date | None = None,
    ) -> Reserva:
        return self._guardar(
            Reserva(
                socio_id=socio.id, libro_id=libro.id, sede_retiro_id=sede_retiro.id,
                fecha_reserva=fecha_reserva or date.today(), estado=estado,
                ejemplar_id=ejemplar.id if ejemplar else None,
                fecha_asignacion=date.today() if ejemplar else None,
                fecha_vencimiento_retiro=fecha_vencimiento_retiro,
            )
        )


@pytest.fixture
def fabrica(session) -> Fabrica:
    return Fabrica(session)


@pytest.fixture
def token_de():
    """`token_de(usuario)` → headers con un JWT válido para ese usuario."""
    from app.utils.security import crear_access_token

    def _headers(usuario: Usuario) -> dict[str, str]:
        return {"Authorization": f"Bearer {crear_access_token(usuario.id)}"}

    return _headers
