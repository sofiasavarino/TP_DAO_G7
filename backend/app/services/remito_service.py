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

from app.services.reserva_service import asignar_ejemplar_a_reserva_mas_vieja

from app.dtos.remito_dto import EjemplarEnRemitoDTO, RemitoCreate, RemitoDetalleDTO, RemitoListadoDTO
from app.exceptions import RemitoNoEncontrado
from app.models.ejemplar import Ejemplar
from app.models.enums import EstadoEjemplar, EstadoRemito, MotivoTraslado
from app.models.remito import Remito
from app.repositories.ejemplar_repository import EjemplarRepository
from app.repositories.remito_repository import RemitoRepository
from app.repositories.reserva_repository import ReservaRepository
from app.repositories.sede_repository import SedeRepository
from app.notifications import mensajes
from app.states.ejemplar_state import estado_de
from app.states.reserva_state import estado_de_reserva

remito_repo = RemitoRepository()
ejemplar_repo = EjemplarRepository()
sede_repo = SedeRepository()
reserva_repo = ReservaRepository()

# Estados en los que puede quedar un ejemplar que llegó con problemas.
ESTADOS_INCIDENCIA = (EstadoEjemplar.EN_REPARACION, EstadoEjemplar.INUTILIZABLE)


def generar_numero_remito(session: Session, hoy: date | None = None) -> str:
    """Genera un R-YYYYMMDD-NNN libre, incrementando el sufijo hasta encontrar hueco."""
    hoy = hoy or date.today()
    base = hoy.strftime("R-%Y%m%d-")
    for sufijo in range(1, 1000):
        numero = f"{base}{sufijo:03d}"
        if not remito_repo.existe_numero(session, numero):
            return numero
    raise ValueError(f"No hay números de remito libres para hoy ({base}). Reporte el problema.")


def to_detalle(session: Session, remito_id: int) -> RemitoDetalleDTO:
    """Remito con ejemplares, sedes y responsables (para la pantalla de detalle)."""
    remito = _get_remito(session, remito_id)
    return _to_detalle_dto(remito)


def _to_detalle_dto(remito: Remito) -> RemitoDetalleDTO:
    """Arma el DTO con la lista de ejemplares embebida (info necesaria para validar despacho/recepción)."""
    return RemitoDetalleDTO(
        id=remito.id,
        numero_remito=remito.numero_remito,
        motivo_traslado=remito.motivo_traslado,
        estado=remito.estado,
        observaciones=remito.observaciones,
        sede_origen_id=remito.sede_origen_id,
        sede_destino_id=remito.sede_destino_id,
        responsable_creacion_id=remito.responsable_creacion_id,
        responsable_despacho_id=remito.responsable_despacho_id,
        responsable_recepcion_id=remito.responsable_recepcion_id,
        fecha_creacion=remito.fecha_creacion,
        fecha_despacho=remito.fecha_despacho,
        fecha_recepcion=remito.fecha_recepcion,
        ejemplares=[
            EjemplarEnRemitoDTO(
                id=e.id,
                codigo_inventario=e.codigo_inventario,
                descripcion_fisica=e.descripcion_fisica,
                libro_nombre=e.libro.nombre,
            )
            for e in remito.ejemplares
        ],
    )


def _to_listado_dto(remito: Remito) -> RemitoListadoDTO:
    return RemitoListadoDTO(
        id=remito.id,
        numero_remito=remito.numero_remito,
        motivo_traslado=remito.motivo_traslado,
        estado=remito.estado,
        sede_origen_id=remito.sede_origen_id,
        sede_destino_id=remito.sede_destino_id,
        ejemplares_count=len(remito.ejemplares),
        fecha_creacion=remito.fecha_creacion,
        fecha_despacho=remito.fecha_despacho,
        fecha_recepcion=remito.fecha_recepcion,
    )


# --------------------------------------------------------------------- operaciones


def crear_remito(session: Session, datos: RemitoCreate, usuario_id: int) -> Remito:
    """Arma un remito en estado CREADO con los ejemplares indicados.

    `usuario_id` es quien lo crea (sale del usuario logueado, no del body).
    Valida: número único (o lo autogenera `R-YYYYMMDD-NNN` si no viene), origen distinto de destino,
    ambas sedes activas y que cada ejemplar exista, esté DISPONIBLE/RESERVADO, esté en la sede de origen
    y no viaje ya en otro remito abierto.
    """
    numero = (datos.numero_remito or "").strip() or generar_numero_remito(session)
    if remito_repo.existe_numero(session, numero):
        raise ValueError(f"Ya existe el remito {numero}.")
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
        numero_remito=numero,
        motivo_traslado=datos.motivo_traslado,
        observaciones=datos.observaciones,
        estado=EstadoRemito.CREADO,
        sede_origen_id=datos.sede_origen_id,
        sede_destino_id=datos.sede_destino_id,
        responsable_creacion_id=usuario_id,
        ejemplares=ejemplares,  # SQLAlchemy genera las filas de remito_ejemplar
    )
    return remito_repo.add(session, remito)


def agregar_ejemplares(session: Session, remito_id: int, ejemplar_ids: list[int]) -> Remito:
    """Agrega ejemplares a un remito en estado CREADO.

    - Incluye ejemplares que viajan a otra sede (reserva en otra sede, etc.).
    - Valida que el remito exista y esté CREADO.
    - Descarta los ejemplares que ya están en este remito.
    - Son validos: existen, están en la sede de origen, están en estado DISPONIBLE/RESERVADO
      y no viajan ya en otro remito abierto.
    """
    remito = _get_remito(session, remito_id)
    _validar_estado(remito, EstadoRemito.CREADO, "agregar ejemplares")

    if not ejemplar_ids:
        raise ValueError("No se indicaron ejemplares para agregar.")
    if len(set(ejemplar_ids)) != len(ejemplar_ids):
        raise ValueError(f"Hay ejemplares repetidos en {ejemplar_ids}.")

    ya = {e.id for e in remito.ejemplares}
    ejemplar_ids = [eid for eid in ejemplar_ids if eid not in ya]
    if not ejemplar_ids:
        raise ValueError(f"Todos los ejemplares indicados ya están en el remito {remito.numero_remito}.")

    ejemplares = _buscar_ejemplares(session, ejemplar_ids)
    _validar_ejemplares_transferibles(
        session, ejemplares, remito.sede_origen_id, excluir_remito_id=remito.id
    )
    remito.ejemplares = remito.ejemplares + ejemplares
    session.flush()
    return remito


def encolar_ejemplar_en_ruta(
    session: Session,
    ejemplar: Ejemplar,
    sede_destino_id: int,
    usuario_id: int,
    motivo_traslado: MotivoTraslado = MotivoTraslado.IDA,
) -> Remito:
    """Encola el ejemplar en el remito CREADO que sale de su sede hacia `sede_destino_id`.

    Si ya hay uno abierto para la ruta, le agrega el ejemplar; si no, crea uno con
    número autogenerado (`R-YYYYMMDD-NNN`). Devuelve el remito elegido.
    """
    candidatos = [
        r
        for r in remito_repo.pendientes_de_despacho(session, sede_origen_id=ejemplar.sede_actual_id)
        if r.sede_destino_id == sede_destino_id
    ]
    if candidatos:
        return agregar_ejemplares(session, candidatos[0].id, [ejemplar.id])

    return crear_remito(
        session,
        RemitoCreate(
            motivo_traslado=motivo_traslado,
            sede_origen_id=ejemplar.sede_actual_id,
            sede_destino_id=sede_destino_id,
            ejemplar_ids=[ejemplar.id],
        ),
        usuario_id=usuario_id,
    )


def despachar(session: Session, remito_id: int, usuario_id: int) -> Remito:
    """CREADO -> EN_TRANSITO. Registra quién y cuándo despachó; los ejemplares
    pasan a EN_TRANSITO y la reserva PENDIENTE de cada uno (si la tiene) pasa a EN_TRANSITO,
    avisándole al socio que su ejemplar viaja.

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
        estado_de(ejemplar).despachar(ejemplar)
        reserva = reserva_repo.get_pendiente_con_ejemplar(session, ejemplar.id)
        if reserva is not None:
            estado_de_reserva(reserva).despachar(reserva)  # PENDIENTE -> EN_TRANSITO
            mensajes.avisar_ejemplar_asignado(session, reserva)

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
    - Si un ejemplar no llegó con incidencia, se busca la reserva más vieja (FIFO global)
      en estado PENDIENTE/EN_TRANSITO para ese libro, misma sede: se asigna
      → LISTA_PARA_RETIRO, ventana de retiro de 2 días hábiles.
      Si la reserva es en otra sede, pasa EN_TRANSITO esperando función que la atienda.
    - `incidencias` = {ejemplar_id: EN_REPARACION | INUTILIZABLE} para los que llegaron
      dañados o destruidos. Esos quedan en ese estado y el remito pasa a CON_INCIDENCIA.
    - `observaciones` se agrega a las del remito (p. ej. "tapa rota del E-0012").
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

    hoy = date.today()
    for ejemplar in remito.ejemplares:
        ejemplar.sede_actual_id = remito.sede_destino_id
        if ejemplar.id in incidencias:
            if incidencias[ejemplar.id] == EstadoEjemplar.INUTILIZABLE:
                estado_de(ejemplar).dar_de_baja(ejemplar)
            else:
                estado_de(ejemplar).enviar_a_reparacion(ejemplar)
            # Si el ejemplar estaba preasignado a una reserva, la liberamos para que
            # el siguiente ejemplar disponible la atienda (el dañado no sirve).
            reserva = reserva_repo.get_vigente_de_ejemplar(session, ejemplar.id)
            if reserva is not None:
                estado_de_reserva(reserva).perder_ejemplar(reserva)  # EN_TRANSITO -> PENDIENTE
                reserva.ejemplar_id = None
                reserva.fecha_asignacion = None
                reserva.fecha_vencimiento_retiro = None
            continue
        estado_de(ejemplar).recibir(ejemplar)  # EN_TRANSITO -> DISPONIBLE
        asignar_ejemplar_a_reserva_mas_vieja(session, ejemplar, hoy, usuario_id=usuario_id)

    remito.estado = EstadoRemito.CON_INCIDENCIA if incidencias else EstadoRemito.RECIBIDO
    remito.fecha_recepcion = hoy
    remito.responsable_recepcion_id = usuario_id
    if observaciones:
        remito.observaciones = (
            f"{remito.observaciones}\n{observaciones}" if remito.observaciones else observaciones
        )

    session.flush()
    return remito


# ------------------------------------------------------------------------ consultas


def obtener_remito(session: Session, remito_id: int) -> RemitoDetalleDTO:
    """Remito con ejemplares, sedes y responsables (para la pantalla de detalle)."""
    return to_detalle(session, remito_id)


def historial_de_ejemplar(session: Session, ejemplar_id: int) -> list[Remito]:
    """Trazabilidad: por qué remitos pasó un ejemplar, del más viejo al más nuevo."""
    return remito_repo.historial_de_ejemplar(session, ejemplar_id)


def listar_remitos(session: Session, estado: EstadoRemito | None = None) -> list[RemitoListadoDTO]:
    """Todos los remitos de la red (o solo los de un estado), del más nuevo al más viejo.
    Es el listado general de la pantalla de remitos (F8.1), incluidos los ya RECIBIDO."""
    estados = [estado] if estado is not None else None
    return [_to_listado_dto(r) for r in remito_repo.listar(session, estados)]


def listar_pendientes_de_despacho(session: Session, sede_id: int | None = None) -> list[RemitoListadoDTO]:
    """Remitos CREADO que tiene que despachar la sede (de origen) indicada."""
    return [_to_listado_dto(r) for r in remito_repo.pendientes_de_despacho(session, sede_origen_id=sede_id)]


def listar_pendientes_de_recepcion(session: Session, sede_id: int | None = None) -> list[RemitoListadoDTO]:
    """Remitos EN_TRANSITO que tiene que recibir la sede (de destino) indicada."""
    return [_to_listado_dto(r) for r in remito_repo.pendientes_de_recepcion(session, sede_destino_id=sede_id)]


def listar_con_incidencia(session: Session, sede_id: int | None = None) -> list[RemitoListadoDTO]:
    """Remitos que llegaron con algún ejemplar dañado (filtrable por sede de destino)."""
    return [_to_listado_dto(r) for r in remito_repo.listar(session, [EstadoRemito.CON_INCIDENCIA], sede_destino_id=sede_id)]


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
        if not estado_de(e).admite("despachar"):
            problemas.append(f"{e.codigo_inventario} está {e.estado.value}")
        elif e.sede_actual_id != sede_origen_id:
            problemas.append(f"{e.codigo_inventario} no está en la sede de origen")

    for e in ejemplares:
        abierto = remito_repo.get_en_transito_de_ejemplar(session, e.id)
        if abierto is not None and abierto.id != excluir_remito_id:
            problemas.append(f"{e.codigo_inventario} ya viaja en el remito {abierto.numero_remito}")
    if problemas:
        raise ValueError("No se pueden enviar: " + "; ".join(problemas) + ".")
