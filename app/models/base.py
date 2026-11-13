from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class BajaLogicaMixin:
    """Agrega la columna `activo` para la baja logica (nunca se borra fisicamente)."""

    activo: Mapped[bool] = mapped_column(default=True)
