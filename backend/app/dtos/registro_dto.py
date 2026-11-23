"""Entradas y salidas del alta de cuentas.

- `RegistroSocioRequest`: el socio se registra solo desde la pantalla pública.
- `RegistroBibliotecarioRequest`: el administrador da de alta a un bibliotecario.

La contraseña viaja en texto plano solo en la request (por HTTPS en producción);
el service la hashea con argon2 y nunca se guarda ni se devuelve.
"""

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# Letras, números, punto, guion y guion bajo (sin espacios).
PATRON_NOMBRE_USUARIO = r"^[A-Za-z0-9._-]+$"


class CuentaBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nombre_usuario: str = Field(min_length=3, max_length=50, pattern=PATRON_NOMBRE_USUARIO)
    password: str = Field(min_length=8, max_length=128)
    nombre: str = Field(min_length=1, max_length=100)
    apellido: str = Field(min_length=1, max_length=100)
    email: EmailStr
    sede_id: int = Field(gt=0)


class RegistroSocioRequest(CuentaBase):
    """Entrada de POST /auth/registro. `sede_id` es la sede donde retira los libros."""

    dni: str = Field(pattern=r"^\d{7,10}$", description="Solo números, sin puntos")
    telefono: str | None = Field(default=None, max_length=30)


class RegistroBibliotecarioRequest(CuentaBase):
    """Entrada de POST /usuarios/bibliotecarios (solo Administrador)."""

    legajo: str = Field(min_length=1, max_length=20)


class EmpleadoListadoDTO(BaseModel):
    """Salida del listado de personal: datos del empleado + su cuenta."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    usuario_id: int
    nombre_usuario: str
    nombre: str
    apellido: str
    email: str
    legajo: str
    sede_id: int
    sede_nombre: str
    activo: bool
