from pydantic import BaseModel


class RolDTO(BaseModel):
    """Salida: catálogo de roles (semilla, no se crea desde la app)."""

    model_config = {"from_attributes": True}

    id: int
    nombre: str
    descripcion: str | None = None
