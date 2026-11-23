from sqlalchemy.orm import Session

from app.dtos.ejemplar_dto import EjemplarCreate, EjemplarLoteCreate
from app.exceptions.catalogo import (
    EjemplarNoEncontrado,
    LibroNoEncontrado,
    SedeNoPermitida,
    TransicionEjemplarInvalida,
)
from app.models.ejemplar import Ejemplar
from app.models.enums import EstadoEjemplar
from app.models.libro import Libro
from app.repositories.ejemplar_repository import EjemplarRepository
from app.repositories.libro_repository import LibroRepository
from app.repositories.sede_repository import SedeRepository

ejemplar_repo = EjemplarRepository()
libro_repo = LibroRepository()
sede_repo = SedeRepository()


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


# ------------------------------------------------------------- inventario (F6)


def listar_inventario(
    session: Session,
    *,
    libro_id: int | None = None,
    sede_id: int | None = None,
    estado: EstadoEjemplar | None = None,
) -> list[Ejemplar]:
    return ejemplar_repo.listar_inventario(session, libro_id=libro_id, sede_id=sede_id, estado=estado)


def crear_ejemplares_lote(
    session: Session, datos: EjemplarLoteCreate, sede_permitida: int | None = None
) -> list[Ejemplar]:
    """Alta de `cantidad` copias de un libro en una sede (origen = actual = esa sede).

    `sede_permitida`: si viene, solo se puede dar de alta en esa sede (el bibliotecario
    opera su propia sede); None = cualquier sede (administrador de la red).

    Códigos: el manual si vino (solo con 1 copia); si no, `I-<sede>-<libro>` como los
    seeds, y para las siguientes `I-<sede>-<libro>-2`, `-3`... saltando los usados.
    Lanza LibroNoEncontrado o ValueError (sede inexistente/de baja, código repetido).
    """
    if libro_repo.get_by_id(session, datos.libro_id) is None:  # solo libros activos
        raise LibroNoEncontrado(f"El libro {datos.libro_id} no existe o está dado de baja.")
    _verificar_sede(datos.sede_id, sede_permitida, "registrar ejemplares")
    if not sede_repo.esta_activa(session, datos.sede_id):
        raise ValueError(f"La sede {datos.sede_id} no existe o está dada de baja.")

    manual = (datos.codigo_inventario or "").strip()
    if manual:
        if ejemplar_repo.existe_codigo(session, manual):
            raise ValueError(f"El código de inventario '{manual}' ya existe.")
        codigos = [manual]
    else:
        codigos = _codigos_libres(session, datos.sede_id, datos.libro_id, datos.cantidad)

    nuevos = [
        Ejemplar(
            codigo_inventario=codigo,
            signatura_topografica=(datos.signatura_topografica or "").strip() or None,
            descripcion_fisica=(datos.descripcion_fisica or "").strip() or None,
            estado=EstadoEjemplar.DISPONIBLE,
            libro_id=datos.libro_id,
            sede_origen_id=datos.sede_id,
            sede_actual_id=datos.sede_id,
        )
        for codigo in codigos
    ]
    ejemplar_repo.add_all(session, nuevos)
    return [ejemplar_repo.get_con_detalle(session, e.id) for e in nuevos]  # type: ignore[misc]


def _codigos_libres(session: Session, sede_id: int, libro_id: int, cantidad: int) -> list[str]:
    base = f"I-{sede_id}-{libro_id}"
    codigos: list[str] = []
    n = 1
    while len(codigos) < cantidad:
        candidato = base if n == 1 else f"{base}-{n}"
        if not ejemplar_repo.existe_codigo(session, candidato):
            codigos.append(candidato)
        n += 1
    return codigos


# Acciones manuales del bibliotecario sobre una copia: (estados de partida, estado final).
# Los demás cambios (reservar, prestar, despachar, recibir) los hacen los services de
# reservas, préstamos y remitos; EN_TRANSITO, PRESTADO y RESERVADO no se tocan desde acá.
ACCIONES_MANUALES: dict[str, tuple[frozenset[EstadoEjemplar], EstadoEjemplar]] = {
    "enviar_a_reparacion": (frozenset({EstadoEjemplar.DISPONIBLE}), EstadoEjemplar.EN_REPARACION),
    "reincorporar": (frozenset({EstadoEjemplar.EN_REPARACION}), EstadoEjemplar.DISPONIBLE),
    "marcar_inutilizable": (
        frozenset({EstadoEjemplar.DISPONIBLE, EstadoEjemplar.EN_REPARACION}),
        EstadoEjemplar.INUTILIZABLE,  # terminal: no hay acción que lo saque de acá
    ),
}

_DESCRIPCION_ACCION = {
    "enviar_a_reparacion": "enviarse a reparación",
    "reincorporar": "reincorporarse como disponible",
    "marcar_inutilizable": "marcarse como inutilizable",
}


def aplicar_accion(
    session: Session, ejemplar_id: int, accion: str, sede_permitida: int | None = None
) -> Ejemplar:
    """Aplica una acción manual validando la transición.

    `sede_permitida`: si viene, el ejemplar tiene que estar físicamente en esa sede
    (sede ACTUAL). Lanza EjemplarNoEncontrado, SedeNoPermitida o TransicionEjemplarInvalida."""
    origenes, destino = ACCIONES_MANUALES[accion]
    ejemplar = ejemplar_repo.get_con_detalle(session, ejemplar_id)
    if ejemplar is None:
        raise EjemplarNoEncontrado(f"El ejemplar {ejemplar_id} no existe.")
    _verificar_sede(ejemplar.sede_actual_id, sede_permitida, "modificar este ejemplar")
    if ejemplar.estado not in origenes:
        raise TransicionEjemplarInvalida(
            f"El ejemplar {ejemplar.codigo_inventario} no puede {_DESCRIPCION_ACCION[accion]}: "
            f"está {ejemplar.estado.value}."
        )
    ejemplar.estado = destino
    session.flush()
    return ejemplar


def _verificar_sede(sede_id: int, sede_permitida: int | None, accion: str) -> None:
    """Cada bibliotecario opera solo el inventario de su sede (el admin, toda la red)."""
    if sede_permitida is not None and sede_id != sede_permitida:
        raise SedeNoPermitida(f"Solo podés {accion} en tu sede.")
