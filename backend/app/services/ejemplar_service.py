from sqlalchemy.orm import Session

from app.dtos.ejemplar_dto import EjemplarCreate
from app.models.ejemplar import Ejemplar
from app.models.enums import EstadoEjemplar
from app.models.libro import Libro
from app.repositories.ejemplar_repository import EjemplarRepository
from app.repositories.libro_repository import LibroRepository

ejemplar_repo = EjemplarRepository()
libro_repo = LibroRepository()


def crear_ejemplar(session: Session, datos: EjemplarCreate) -> Ejemplar:
    """Da de alta un ejemplar físico.

    Valida que el libro exista y que el código de inventario sea único.
    Lanza ValueError si algo falla (el router lo traduce a 400).
    """
    if libro_repo.get_by_id(session, datos.libro_id, incluir_inactivos=True) is None:
        raise ValueError(f"libro {datos.libro_id} no existe")
    if ejemplar_repo.existe_codigo(session, datos.codigo_inventario):
        raise ValueError(f"código de inventario '{datos.codigo_inventario}' ya existe")

    ejemplar = Ejemplar(
        codigo_inventario=datos.codigo_inventario,
        signatura_topografica=datos.signatura_topografica,
        descripcion_fisica=datos.descripcion_fisica,
        estado=EstadoEjemplar.DISPONIBLE,
        libro_id=datos.libro_id,
        sede_origen_id=datos.sede_origen_id,
        sede_actual_id=datos.sede_actual_id,
    )
    return ejemplar_repo.add(session, ejemplar)


def listar_disponibles(
    session: Session, libro_id: int | None = None, sede_id: int | None = None
) -> list[Ejemplar]:
    return ejemplar_repo.listar_disponibles(session, libro_id=libro_id, sede_id=sede_id)


def listar_por_libro(session: Session, libro_id: int) -> list[Ejemplar]:
    return ejemplar_repo.listar_por_libro(session, libro_id)


def cambiar_estado(session: Session, ejemplar_id: int, estado: EstadoEjemplar) -> Ejemplar:
    ejemplar = ejemplar_repo.get_by_id(session, ejemplar_id, incluir_inactivos=True)
    if ejemplar is None:
        raise ValueError(f"ejemplar {ejemplar_id} no existe")
    ejemplar.estado = estado
    return ejemplar_repo.add(session, ejemplar)
