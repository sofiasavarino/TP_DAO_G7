# from pydantic import BaseModel, ConfigDict

# from app.models.enums import EstadoSocio


# class SocioCreate(BaseModel):
#     """Entrada: alta de socio desde mostrador."""

#     nombre: str
#     apellido: str
#     dni: str
#     telefono: str | None = None


# class SocioDTO(BaseModel):
#     """Salida: ficha de socio."""

#     model_config = ConfigDict(from_attributes=True)

#     id: int
#     nombre: str
#     apellido: str
#     dni: str
#     telefono: str | None = None
#     estado: EstadoSocio

from typing import Any

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.enums import EstadoSocio


class SocioCreate(BaseModel):
    """Entrada: alta de socio desde mostrador."""

    nombre: str
    apellido: str
    dni: str
    telefono: str | None = None


class SocioDTO(BaseModel):
    """Salida: ficha de socio."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    usuario_id: int | None = None
    nombre_usuario: str | None = None
    nombre: str
    apellido: str
    dni: str
    telefono: str | None = None
    estado: EstadoSocio

    @model_validator(mode="before")
    @classmethod
    def extraer_usuario(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            usuario = getattr(data, "usuario", None)
            return {
                "id": data.id,
                "usuario_id": getattr(data, "usuario_id", None),
                "nombre_usuario": getattr(usuario, "nombre_usuario", None) if usuario else None,
                "nombre": data.nombre,
                "apellido": data.apellido,
                "dni": data.dni,
                "telefono": data.telefono,
                "estado": data.estado,
            }
        return data