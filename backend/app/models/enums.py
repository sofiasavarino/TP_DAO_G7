import enum


class TipoPrestamo(enum.Enum):
    LOCAL = "LOCAL"
    INTERBIBLIOTECARIO = "INTERBIBLIOTECARIO"


class EstadoPrestamo(enum.Enum):
    ACTIVO = "ACTIVO"
    VENCIDO = "VENCIDO"
    FINALIZADO = "FINALIZADO"


class EstadoEjemplar(enum.Enum):
    DISPONIBLE = "DISPONIBLE"
    RESERVADO = "RESERVADO"
    EN_TRANSITO = "EN_TRANSITO"
    PRESTADO = "PRESTADO"
    EN_REPARACION = "EN_REPARACION"
    INUTILIZABLE = "INUTILIZABLE"


class EstadoRemito(enum.Enum):
    CREADO = "CREADO"
    EN_TRANSITO = "EN_TRANSITO"
    RECIBIDO = "RECIBIDO"
    CON_INCIDENCIA = "CON_INCIDENCIA"


class EstadoReserva(enum.Enum):
    PENDIENTE = "PENDIENTE"
    EN_CAMINO = "EN_CAMINO"
    LISTA_PARA_RETIRO = "LISTA_PARA_RETIRO"
    CUMPLIDA = "CUMPLIDA"
    VENCIDA = "VENCIDA"
    CANCELADA = "CANCELADA"


class EstadoSocio(enum.Enum):
    ACTIVO = "ACTIVO"
    SUSPENDIDO = "SUSPENDIDO"
    BAJA = "BAJA"


class TipoSancion(enum.Enum):
    MULTA = "MULTA"            # usa `monto`
    SUSPENSION = "SUSPENSION"  # usa `dias_suspension`


class MotivoTraslado(enum.Enum):
    IDA = "IDA"              # remito de préstamo saliente (envio interbibliotecario)
    REBALANCEO = "REBALANCEO"  # relocalización administrativa entre sedes, sin préstamo


class NotificacionTipo(enum.Enum):
    RESERVA_LISTA = "RESERVA_LISTA"                  # el ejemplar llegó y hay 48 hs para retirarlo
    RESERVA_VENCIDA = "RESERVA_VENCIDA"              # venció la ventana de retiro
    SANCION_APLICADA = "SANCION_APLICADA"            # se le aplicó una sanción
    SANCION_LEVANTADA = "SANCION_LEVANTADA"          # se levantó una sanción
    EJEMPLAR_ASIGNADO = "EJEMPLAR_ASIGNADO"          # le asignaron un ejemplar para retiro
