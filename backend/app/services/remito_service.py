"""Service de remitos: empaquetar, despachar y recibir ejemplares entre sedes.

Ciclo de vida del remito (enum EstadoRemito):

    CREADO --despachar--> EN_TRANSITO --recibir--> RECIBIDO
                                          \\------> CON_INCIDENCIA (llego algo dañado)

Qué le pasa a cada ejemplar del remito:

    crear      -> no cambia de estado (sigue DISPONIBLE o RESERVADO en la sede de origen)
    despachar  -> EN_TRANSITO
    recibir    -> sede_actual = sede destino (inventario flotante) y queda
                  RESERVADO si alguien lo tiene reservado, si no DISPONIBLE;
                  los informados con incidencia quedan EN_REPARACION o INUTILIZABLE.

Convención del proyecto (igual que ejemplar_service y libro_service):
- Las funciones reciben la `session` y NO hacen commit: lo hace el controller.
- Todas las validaciones se hacen ANTES de modificar nada; si algo falla la base
  queda intacta. Errores: `RemitoNoEncontrado` si el remito no existe y `ValueError`
  para el resto de las validaciones (igual que ejemplar_service: el router lo pasa a 400).
- Devuelven objetos del modelo; el controller arma el DTO.
"""

from collections.abc import Mapping
from datetime import date

from sqlalchemy.orm import Session

from app.dtos.remito_dto import RemitoCreate
from app.exceptions import RemitoNoEncontrado
from app.models.ejemplar import Ejemplar
from app.models.enums import EstadoEjemplar, EstadoRemito
from app.models.remito import Remito
from app.repositories.ejemplar_repository import EjemplarRepository
from app.repositories.remito_repository import RemitoRepository
from app.repositories.reserva_repository import ReservaRepository
from app.repositories.sede_repository import SedeRepository

remito_repo = RemitoRepository()
ejemplar_repo = EjemplarRepository()
sede_repo = SedeRepository()
reserva_repo = ReservaRepository()

# Estados desde los que un ejemplar puede subirse a un remito.
ESTADOS_TRANSFERIBLES = (EstadoEjemplar.DISPONIBLE, EstadoEjemplar.RESERVADO)

# Estados en los que puede quedar un ejemplar que llegó con problemas.
ESTADOS_INCIDENCIA = (EstadoEjemplar.EN_REPARACION, EstadoEjemplar.INUTILIZABLE)


# --------------------------------------------------------------------- operaciones


def crear_remito(session: Session, datos: RemitoCreate, usuario_id: int) -> Remito:
    """Arma un remito en estado CREADO con los ejemplares indicados.

    `usuario_id` es quien lo crea (sale del usuario logueado, no del body).
    Valida: número único, origen distinto de destino, ambas sedes activas y que
    cada ejemplar exista, esté DISPONIBLE/RESERVADO, esté en la sede de origen
    y no viaje ya en otro remito abierto.
    """
    if remito_repo.existe_numero(session, datos.numero_remito):
        raise ValueError(f"Ya existe el remito {datos.numero_remito}.")
    if datos.sede_origen_id == datos.sede_destino_id:
        raise ValueError("La sede de origen y la de destino no pueden ser la misma.")
    if not datos.ejemplar_ids:
        raise ValueError("El remito tiene que llevar al menos un ejemplar.")
    if len(set(datos.ejemplar_ids)) != len(datos.ejemplar_ids):
        raise ValueError("Hay ejemplares repetidos en el remito.")

    _validar_sedes_activas(session, datos.sede_origen_id, datos.sede_destino_id)
    ejemplares = _buscar_ejemplares(session, datos.ejemplar_ids)
    _validar_ejemplares_transferibles(session, ejemplares, datos.sede_origen_id)

    remito = Remito(
        numero_remito=datos.numero_remito,
        motivo_traslado=datos.motivo_traslado,
        observaciones=datos.observaciones,
        estado=EstadoRemito.CREADO,
        sede_origen_id=datos.sede_origen_id,
        sede_destino_id=datos.sede_destino_id,
        responsable_creacion_id=usuario_id,
        ejemplares=ejemplares,  # SQLAlchemy genera las filas de remito_ejemplar
    )
    return remito_repo.add(session, remito)


def despachar(session: Session, remito_id: int, usuario_id: int) -> Remito:
    """CREADO -> EN_TRANSITO. Registra quién y cuándo despachó; los ejemplares
    pasan a EN_TRANSITO.

    Se vuelven a validar sedes y ejemplares porque entre la creación y el despacho
    pudo cambiar algo (p. ej. alguien prestó un ejemplar o dieron de baja una sede).
    """
    remito = _get_remito(session, remito_id)
    _validar_estado(remito, EstadoRemito.CREADO, "despachar")
    _validar_sedes_activas(session, remito.sede_origen_id, remito.sede_destino_id)
    _validar_ejemplares_transferibles(
        session, remito.ejemplares, remito.sede_origen_id, excluir_remito_id=remito.id
    )

    remito.estado = EstadoRemito.EN_TRANSITO
    remito.fecha_despacho = date.today()
    remito.responsable_despacho_id = usuario_id
    for ejemplar in remito.ejemplares:
        ejemplar.estado = EstadoEjemplar.EN_TRANSITO

    session.flush()
    return remito


def recibir(
    session: Session,
    remito_id: int,
    usuario_id: int,
    incidencias: Mapping[int, EstadoEjemplar] | None = None,
    observaciones: str | None = None,
) -> Remito:
    """EN_TRANSITO -> RECIBIDO (o CON_INCIDENCIA si se informa algún problema).

    - Todos los ejemplares quedan en la sede de destino (inventario flotante).
    - Si un ejemplar tiene una reserva vigente asignada queda RESERVADO; si no, DISPONIBLE.
    - `incidencias` = {ejemplar_id: EN_REPARACION | INUTILIZABLE} para los que llegaron
      dañados o destruidos. Esos quedan en ese estado y el remito pasa a CON_INCIDENCIA.
    - `observaciones` se agrega a las del remito (p. ej. "tapa rota del E-0012").

    Ojo: esto NO cambia el estado de las reservas (EN_CAMINO -> LISTA_PARA_RETIRO,
    plazo de 48 hs, aviso al socio). Eso le toca a reserva_service.llegada_a_sede(),
    que se tiene que llamar con la misma session después de recibir.
    """
    incidencias = dict(incidencias or {})
    remito = _get_remito(session, remito_id)
    _validar_estado(remito, EstadoRemito.EN_TRANSITO, "recibir")

    ids_del_remito = {e.id for e in remito.ejemplares}
    ajenos = sorted(set(incidencias) - ids_del_remito)
    if ajenos:
        raise ValueError(f"Los ejemplares {ajenos} no pertenecen al remito {remito.numero_remito}.")
    invalidos = sorted(i for i, est in incidencias.items() if est not in ESTADOS_INCIDENCIA)
    if invalidos:
        raise ValueError(
            f"Estado de incidencia inválido para {invalidos}: solo EN_REPARACION o INUTILIZABLE."
        )

    for ejemplar in remito.ejemplares:
        ejemplar.sede_actual_id = remito.sede_destino_id
        if ejemplar.id in incidencias:
            ejemplar.estado = incidencias[ejemplar.id]
        elif reserva_repo.get_vigente_de_ejemplar(session, ejemplar.id) is not None:
            ejemplar.estado = EstadoEjemplar.RESERVADO
        else:
            ejemplar.estado = EstadoEjemplar.DISPONIBLE

    remito.estado = EstadoRemito.CON_INCIDENCIA if incidencias else EstadoRemito.RECIBIDO
    remito.fecha_recepcion = date.today()
    remito.responsable_recepcion_id = usuario_id
    if observaciones:
        remito.observaciones = (
            f"{remito.observaciones}\n{observaciones}" if remito.observaciones else observaciones
        )

    session.flush()
    return remito


# ------------------------------------------------------------------------ consultas


def obtener_remito(session: Session, remito_id: int) -> Remito:
    """Remito con ejemplares, sedes y responsables (para la pantalla de detalle)."""
    return _get_remito(session, remito_id)


def historial_de_ejemplar(session: Session, ejemplar_id: int) -> list[Remito]:
    """Trazabilidad: por qué remitos pasó un ejemplar, del más viejo al más nuevo."""
    return remito_repo.historial_de_ejemplar(session, ejemplar_id)


def listar_pendientes_de_despacho(session: Session, sede_id: int | None = None) -> list[Remito]:
    """Remitos CREADO que tiene que despachar la sede (de origen) indicada."""
    return remito_repo.pendientes_de_despacho(session, sede_origen_id=sede_id)


def listar_pendientes_de_recepcion(session: Session, sede_id: int | None = None) -> list[Remito]:
    """Remitos EN_TRANSITO que tiene que recibir la sede (de destino) indicada."""
    return remito_repo.pendientes_de_recepcion(session, sede_destino_id=sede_id)


def listar_con_incidencia(session: Session, sede_id: int | None = None) -> list[Remito]:
    """Remitos que llegaron con algún ejemplar dañado (filtrable por sede de destino)."""
    return remito_repo.listar(session, [EstadoRemito.CON_INCIDENCIA], sede_destino_id=sede_id)


# ------------------------------------------------------------------------- helpers


def _get_remito(session: Session, remito_id: int) -> Remito:
    remito = remito_repo.get_con_ejemplares(session, remito_id)
    if remito is None:
        raise RemitoNoEncontrado(f"No existe el remito {remito_id}.")
    return remito


def _validar_estado(remito: Remito, esperado: EstadoRemito, accion: str) -> None:
    if remito.estado != esperado:
        raise ValueError(
            f"No se puede {accion} el remito {remito.numero_remito}: "
            f"está {remito.estado.value} y tiene que estar {esperado.value}."
        )


def _validar_sedes_activas(session: Session, *sede_ids: int) -> None:
    for sede_id in sede_ids:
        sede = sede_repo.get_by_id(session, sede_id, incluir_inactivos=True)
        if sede is None:
            raise ValueError(f"No existe la sede {sede_id}.")
        if not sede.activo:
            raise ValueError(f"La sede {sede.nombre} está dada de baja.")


def _buscar_ejemplares(session: Session, ids: list[int]) -> list[Ejemplar]:
    encontrados = ejemplar_repo.get_by_ids(session, ids)
    faltantes = sorted(set(ids) - {e.id for e in encontrados})
    if faltantes:
        raise ValueError(f"No existen los ejemplares {faltantes}.")
    return encontrados


def _validar_ejemplares_transferibles(
    session: Session,
    ejemplares: list[Ejemplar],
    sede_origen_id: int,
    excluir_remito_id: int | None = None,
) -> None:
    """Junta TODOS los problemas y los informa juntos, así el bibliotecario
    corrige el remito de una sola vez en vez de ir error por error."""
    problemas: list[str] = []
    for e in ejemplares:
        if e.estado not in ESTADOS_TRANSFERIBLES:
            problemas.append(f"{e.codigo_inventario} está {e.estado.value}")
        elif e.sede_actual_id != sede_origen_id:
            problemas.append(f"{e.codigo_inventario} no está en la sede de origen")

    for e in ejemplares:
        abierto = remito_repo.get_en_transito_de_ejemplar(session, e.id)
        if abierto is not None and abierto.id != excluir_remito_id:
            problemas.append(f"{e.codigo_inventario} ya viaja en el remito {abierto.numero_remito}")
    if problemas:
        raise ValueError("No se pueden enviar: " + "; ".join(problemas) + ".")
