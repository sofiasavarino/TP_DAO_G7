"""Capa de acceso a datos: un repository por entidad sobre BaseRepository.

Uso tipico desde un service:

    with SessionLocal.begin() as session:
        socio = socio_repo.get_by_id(session, socio_id)
        if prestamo_repo.contar_abiertos_socio(session, socio.id) >= MAX:
            raise LimitePrestamosExcedido(...)
"""

from app.repositories.autor_repository import AutorRepository
from app.repositories.base_repository import BaseRepository
from app.repositories.ejemplar_repository import EjemplarRepository
from app.repositories.libro_repository import LibroRepository
from app.repositories.notificacion_repository import NotificacionRepository
from app.repositories.prestamo_repository import PrestamoRepository
from app.repositories.remito_repository import RemitoRepository
from app.repositories.reserva_repository import ReservaRepository
from app.repositories.rol_repository import RolRepository
from app.repositories.sancion_repository import SancionRepository
from app.repositories.sede_repository import SedeRepository
from app.repositories.socio_repository import SocioRepository
from app.repositories.usuario_repository import UsuarioRepository

__all__ = [
    "AutorRepository", "BaseRepository", "EjemplarRepository", "LibroRepository",
    "NotificacionRepository", "PrestamoRepository", "RemitoRepository",
    "ReservaRepository", "RolRepository", "SancionRepository", "SedeRepository",
    "SocioRepository", "UsuarioRepository",
]
