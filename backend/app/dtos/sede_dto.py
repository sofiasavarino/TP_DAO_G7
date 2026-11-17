from pydantic import BaseModel, ConfigDict


class SedeDTO(BaseModel):
    """Salida: dropdowns/pickers y ficha de sede. Las sedes se crean por semilla administrativa."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    direccion: str
    telefono: str | None = None
    email: str | None = None
    horario_atencion: str | None = None
    activo: bool
