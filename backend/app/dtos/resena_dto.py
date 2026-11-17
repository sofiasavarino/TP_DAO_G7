from pydantic import BaseModel, ConfigDict, Field


class ResenaCreate(BaseModel):
    """Entrada: el socio califica un libro."""

    puntuacion: int = Field(ge=1, le=5)
    descripcion: str | None = Field(default=None, max_length=1000)


class ResenaDTO(BaseModel):
    """Salida: reseña en el detalle del libro y en la ficha del socio."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    descripcion: str | None = None
    puntuacion: int
    socio_id: int
    libro_id: int
