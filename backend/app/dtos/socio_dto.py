from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.enums import EstadoSocio


class SocioCreate(BaseModel):
    """Entrada: alta de socio desde mostrador."""

    nombre: str
    apellido: str
    dni: str
    email: EmailStr
    telefono: str | None = None


class SocioDTO(BaseModel):
    """Salida: ficha de socio."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    apellido: str
    dni: str
    email: EmailStr
    telefono: str | None = None
    estado: EstadoSocio
