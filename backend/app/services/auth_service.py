from sqlalchemy.orm import Session

from app.exceptions import CredencialesInvalidas
from app.repositories.usuario_repository import UsuarioRepository
from app.utils.security import crear_access_token, hash_password, verify_password
from app.dtos.auth_dto import MeDTO
from app.models.usuario import Usuario

usuario_repo = UsuarioRepository()

# Hash de relleno: si el usuario no existe igual hacemos una verificación, para que
# "usuario inexistente" y "contraseña incorrecta" tarden lo mismo (evita enumerar usuarios).
_HASH_DUMMY = hash_password("relleno-para-igualar-tiempos")


def autenticar(session: Session, nombre_usuario: str, password: str) -> str:
    """Valida credenciales y devuelve un access token. Lanza `CredencialesInvalidas`.

    El repository solo devuelve usuarios activos, así que un usuario dado de baja
    no puede loguearse.
    """
    usuario = usuario_repo.get_by_nombre_usuario(session, nombre_usuario)
    if usuario is None:
        verify_password(password, _HASH_DUMMY)
        raise CredencialesInvalidas()
    if not verify_password(password, usuario.hash):
        raise CredencialesInvalidas()
    return crear_access_token(usuario.id)

def to_me_dto(usuario: Usuario) -> MeDTO:
    """Arma la respuesta de /auth/me. El usuario debe venir con `get_con_detalle`."""
    perfil = usuario.socio or usuario.empleado
    dto = MeDTO.model_validate(usuario)
    dto.nombre = perfil.nombre if perfil else None
    dto.apellido = perfil.apellido if perfil else None
    dto.telefono = usuario.socio.telefono if usuario.socio else None
    dto.socio_id = usuario.socio.id if usuario.socio else None
    dto.empleado_id = usuario.empleado.id if usuario.empleado else None
    return dto