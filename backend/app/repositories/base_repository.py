"""Repository base generico.

Un repository es la unica clase que sabe *como* consultar una tabla. Los services
le piden datos ("dame el socio con este DNI", "cuantos prestamos activos tiene")
y el repository arma la query de SQLAlchemy y devuelve objetos del modelo.

Reglas de la capa (ver README):
- Todos los metodos reciben la `session` que abrio el service. El repository
  NUNCA hace `commit()` ni `rollback()`: eso es responsabilidad del service
  (Unit of Work con `SessionLocal.begin()`).
- Como mucho hace `flush()`, que manda el INSERT/UPDATE a la base dentro de la
  transaccion abierta (sirve para obtener el `id` generado) pero no confirma nada.
- No tiene reglas de negocio: no decide si un socio puede pedir un prestamo,
  solo le da al service los datos para que lo decida.

Baja logica: algunas entidades tienen la columna `activo` (BajaLogicaMixin) y
otras representan la baja con un estado propio (p. ej. `Socio.estado = BAJA`).
Para no repetir codigo, la base define dos "ganchos" que cada repository puede
redefinir (patron Template Method):
- `_condicion_activo()`: el filtro SQL que define "esta activo".
- `_marcar_baja(obj)`: que cambiar en el objeto para darlo de baja.
"""

from typing import Any, Generic, TypeVar

from sqlalchemy import ColumnElement, Select, func, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.interfaces import LoaderOption

from app.models.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    """CRUD generico. Cada subclase solo tiene que indicar `model`."""

    model: type[ModelT]

    # ------------------------------------------------------------------ ganchos

    def _condicion_activo(self) -> ColumnElement[bool] | None:
        """Filtro que define "registro activo". `None` = la entidad no tiene baja."""
        if hasattr(self.model, "activo"):
            return self.model.activo.is_(True)  # type: ignore[attr-defined]
        return None

    def _marcar_baja(self, obj: ModelT) -> None:
        """Marca el objeto como dado de baja (nunca se borra fisicamente)."""
        if not hasattr(obj, "activo"):
            raise TypeError(
                f"{self.model.__name__} no tiene baja logica: no se puede dar de baja."
            )
        obj.activo = False  # type: ignore[attr-defined]

    # --------------------------------------------------------------- utilidades

    def _select(self, incluir_inactivos: bool = False) -> Select[tuple[ModelT]]:
        """SELECT del modelo, filtrando los dados de baja salvo que se pida lo contrario."""
        stmt = select(self.model)
        condicion = None if incluir_inactivos else self._condicion_activo()
        if condicion is not None:
            stmt = stmt.where(condicion)
        return stmt

    # ----------------------------------------------------------------- lectura

    def get_by_id(
        self,
        session: Session,
        id_: int,
        *opciones: LoaderOption,
        incluir_inactivos: bool = False,
    ) -> ModelT | None:
        """Busca por PK. `opciones` permite precargar relaciones, p. ej.
        `repo.get_by_id(session, 5, selectinload(Libro.autores))`."""
        stmt = self._select(incluir_inactivos).where(self.model.id == id_)  # type: ignore[attr-defined]
        if opciones:
            stmt = stmt.options(*opciones)
        return session.scalars(stmt).first()

    def list_activos(self, session: Session, *opciones: LoaderOption) -> list[ModelT]:
        """Todos los registros activos, ordenados por id."""
        stmt = self._select().order_by(self.model.id)  # type: ignore[attr-defined]
        if opciones:
            stmt = stmt.options(*opciones)
        return list(session.scalars(stmt))

    def list_todos(self, session: Session, *opciones: LoaderOption) -> list[ModelT]:
        """Todos los registros, incluidos los dados de baja (pantallas de admin)."""
        stmt = self._select(incluir_inactivos=True).order_by(self.model.id)  # type: ignore[attr-defined]
        if opciones:
            stmt = stmt.options(*opciones)
        return list(session.scalars(stmt))

    def count(
        self,
        session: Session,
        *filtros: ColumnElement[bool],
        incluir_inactivos: bool = False,
    ) -> int:
        """`SELECT COUNT(*)` con filtros opcionales. Se resuelve en la base,
        sin traer las filas a Python."""
        stmt = select(func.count()).select_from(self.model)
        condicion = None if incluir_inactivos else self._condicion_activo()
        if condicion is not None:
            stmt = stmt.where(condicion)
        if filtros:
            stmt = stmt.where(*filtros)
        return session.scalar(stmt) or 0

    def exists(
        self,
        session: Session,
        *filtros: ColumnElement[bool],
        solo_activos: bool = False,
    ) -> bool:
        """`SELECT EXISTS(...)`. Por defecto mira tambien los dados de baja, porque
        para evitar duplicados (DNI, ISBN, codigo) un registro inactivo tambien cuenta."""
        sub = select(self.model.id)  # type: ignore[attr-defined]
        condicion = self._condicion_activo() if solo_activos else None
        if condicion is not None:
            sub = sub.where(condicion)
        if filtros:
            sub = sub.where(*filtros)
        return bool(session.scalar(select(sub.exists())))

    # ---------------------------------------------------------------- escritura

    def add(self, session: Session, obj: ModelT) -> ModelT:
        """Agrega el objeto a la sesion y hace flush para que tenga `id`.
        El commit lo hace el service al cerrar la transaccion."""
        session.add(obj)
        session.flush()
        return obj

    def add_all(self, session: Session, objs: list[ModelT]) -> list[ModelT]:
        session.add_all(objs)
        session.flush()
        return objs

    def soft_delete(self, session: Session, obj_o_id: ModelT | int) -> ModelT | None:
        """Baja logica. Acepta el objeto o su id; devuelve `None` si el id no existe."""
        obj: Any = obj_o_id
        if isinstance(obj_o_id, int):
            obj = self.get_by_id(session, obj_o_id, incluir_inactivos=True)
            if obj is None:
                return None
        self._marcar_baja(obj)
        session.flush()
        return obj
