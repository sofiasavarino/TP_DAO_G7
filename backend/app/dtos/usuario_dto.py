from pydantic import BaseModel, ConfigDict, EmailStr

from app.dtos.rol_dto import RolDTO
from app.dtos.sede_dto import SedeDTO


class UsuarioSesionDTO(BaseModel):
    """Salida de login/menu. NUNCA incluye el hash."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre_usuario: str
    email: str
    activo: bool
    rol: RolDTO
    sede: SedeDTO


class UsuarioListadoDTO(BaseModel):
    """Salida de administración: usuarios activos/inactivos, sin datos sensibles."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre_usuario: str
    activo: bool
    rol_id: int
    sede_id: int


class UsuarioCreate(BaseModel):
    """Entrada: alta de credenciales (la crea la app, no semilla)."""

    nombre_usuario: str
    email: EmailStr
    hash: str  # lo hashea el service; jamás se recibe como texto plano de la vista
    rol_id: int
    sede_id: int
