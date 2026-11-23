"""Alta de cuentas: socios (autorregistro) y bibliotecarios (los crea el administrador).

Cada alta crea dos filas en la misma transacción:
    Usuario (credenciales, rol, sede)  +  Socio o Empleado (datos personales)

El service hace `flush()` para obtener ids; el `commit()` lo hace el controller,
igual que en el resto de los services.
"""

from sqlalchemy.orm import Session

from app.dtos.registro_dto import (
    EmpleadoListadoDTO,
    RegistroBibliotecarioRequest,
    RegistroSocioRequest,
    CuentaBase,
)
from app.exceptions.usuario import DatoDuplicado, RolNoConfigurado, SedeInvalida
from app.models.empleado import Empleado
from app.models.enums import EstadoSocio
from app.models.socio import Socio
from app.models.usuario import Usuario
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.rol_repository import RolRepository
from app.repositories.sede_repository import SedeRepository
from app.repositories.socio_repository import SocioRepository
from app.repositories.usuario_repository import UsuarioRepository
from app.utils.security import hash_password

# Nombres exactos de los roles cargados en seeds.py
ROL_SOCIO = "Socio"
ROL_BIBLIOTECARIO = "Bibliotecario"

usuario_repo = UsuarioRepository()
socio_repo = SocioRepository()
empleado_repo = EmpleadoRepository()
rol_repo = RolRepository()
sede_repo = SedeRepository()


def _crear_usuario(session: Session, datos: CuentaBase, rol_nombre: str) -> Usuario:
    """Validaciones comunes + alta de las credenciales. No confirma la transacción."""
    if usuario_repo.existe_nombre_usuario(session, datos.nombre_usuario):
        raise DatoDuplicado("nombre_usuario", "Ese nombre de usuario ya está en uso.")
    if usuario_repo.existe_email(session, datos.email):
        raise DatoDuplicado("email", "Ya hay una cuenta registrada con ese email.")
    if not sede_repo.esta_activa(session, datos.sede_id):
        raise SedeInvalida("La sede elegida no existe o no está activa.")
    rol = rol_repo.get_by_nombre(session, rol_nombre)
    if rol is None:
        raise RolNoConfigurado(f"No existe el rol '{rol_nombre}'. ¿Se corrieron los seeds?")

    return usuario_repo.add(
        session,
        Usuario(
            nombre_usuario=datos.nombre_usuario,
            email=str(datos.email).lower(),
            hash=hash_password(datos.password),
            rol_id=rol.id,
            sede_id=datos.sede_id,
        ),
    )


def registrar_socio(session: Session, datos: RegistroSocioRequest) -> Usuario:
    """Autorregistro de un socio. Devuelve el Usuario creado (con `socio` vinculado)."""
    if socio_repo.existe_dni(session, datos.dni):
        raise DatoDuplicado("dni", "Ya hay un socio registrado con ese DNI.")

    usuario = _crear_usuario(session, datos, ROL_SOCIO)
    socio_repo.add(
        session,
        Socio(
            nombre=datos.nombre,
            apellido=datos.apellido,
            dni=datos.dni,
            telefono=datos.telefono or None,
            estado=EstadoSocio.ACTIVO,
            usuario_id=usuario.id,
        ),
    )
    return usuario


def registrar_bibliotecario(session: Session, datos: RegistroBibliotecarioRequest) -> Empleado:
    """Alta de un bibliotecario por parte del administrador. Devuelve el Empleado creado."""
    if empleado_repo.existe_legajo(session, datos.legajo):
        raise DatoDuplicado("legajo", "Ya hay un empleado con ese legajo.")

    usuario = _crear_usuario(session, datos, ROL_BIBLIOTECARIO)
    return empleado_repo.add(
        session,
        Empleado(
            nombre=datos.nombre,
            apellido=datos.apellido,
            legajo=datos.legajo,
            usuario_id=usuario.id,
        ),
    )

def listar_bibliotecarios(session: Session) -> list[Empleado]:
    return empleado_repo.listar_por_rol(session, ROL_BIBLIOTECARIO)


def to_empleado_listado_dto(empleado: Empleado) -> EmpleadoListadoDTO:
    usuario = empleado.usuario
    return EmpleadoListadoDTO(
        id=empleado.id,
        usuario_id=usuario.id,
        nombre_usuario=usuario.nombre_usuario,
        nombre=empleado.nombre,
        apellido=empleado.apellido,
        email=usuario.email,
        legajo=empleado.legajo,
        sede_id=usuario.sede_id,
        sede_nombre=usuario.sede.nombre,
        activo=empleado.activo and usuario.activo,
    )
