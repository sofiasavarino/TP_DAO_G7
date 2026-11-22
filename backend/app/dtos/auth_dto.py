from pydantic import BaseModel, Field
from app.dtos.usuario_dto import UsuarioSesionDTO


class LoginRequest(BaseModel):
    """Entrada de POST /auth/login."""

    usuario: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class TokenDTO(BaseModel):
    """Salida de POST /auth/login."""

    access_token: str
    token_type: str = "bearer"

class MeDTO(UsuarioSesionDTO):
    """Salida de GET /auth/me: usuario con rol y sede, más su perfil (socio o empleado).

    Para un socio vienen `socio_id`; para bibliotecario/administrador, `empleado_id`.
    """

    nombre: str | None = None
    apellido: str | None = None
    socio_id: int | None = None
    empleado_id: int | None = None