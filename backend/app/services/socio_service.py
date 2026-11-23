"""Service de socios: consultas para el mostrador.

Igual que el resto de los services: recibe la `session` y no hace commit.
"""

from sqlalchemy.orm import Session

from app.dtos.socio_dto import SocioDTO
from app.repositories.socio_repository import SocioRepository

socio_repo = SocioRepository()


def buscar_socios(session: Session, texto: str) -> list[SocioDTO]:
    """Busca socios por nombre, apellido o DNI (sin distinguir tildes ni mayúsculas).

    No devuelve los dados de baja. Con texto vacío devuelve lista vacía
    (para el padrón completo usar listar_socios).
    """
    texto = texto.strip()
    if not texto:
        return []
    return [SocioDTO.model_validate(s) for s in socio_repo.buscar(session, texto)]


def listar_socios(session: Session) -> list[SocioDTO]:
    """Padrón completo (incluye SUSPENDIDO y BAJA), ordenado por apellido y nombre (F8.3)."""
    socios = sorted(socio_repo.list_todos(session), key=lambda s: (s.apellido.lower(), s.nombre.lower()))
    return [SocioDTO.model_validate(s) for s in socios]
