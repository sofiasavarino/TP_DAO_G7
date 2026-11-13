import enum


class TipoPrestamo(enum.Enum):
    LOCAL = "LOCAL"
    INTERBIBLIOTECARIO = "INTERBIBLIOTECARIO"


class EstadoPrestamo(enum.Enum):
    ACTIVO = "ACTIVO"
    VENCIDO = "VENCIDO"
    DEVUELTO = "DEVUELTO"


class EstadoEjemplar(enum.Enum):
    DISPONIBLE = "DISPONIBLE"
    PRESTADO = "PRESTADO"
    EN_TRANSITO = "EN_TRANSITO"
    DANADO = "DANADO"
    BAJA = "BAJA"


class EstadoRemito(enum.Enum):
    CREADO = "CREADO"
    DESPACHADO = "DESPACHADO"
    RECIBIDO = "RECIBIDO"


class EstadoReserva(enum.Enum):
    PENDIENTE = "PENDIENTE"
    ASIGNADA = "ASIGNADA"
    EXPIRADA = "EXPIRADA"
    CANCELADA = "CANCELADA"


class EstadoSocio(enum.Enum):
    ACTIVO = "ACTIVO"
    SUSPENDIDO = "SUSPENDIDO"
    BAJA = "BAJA"


class TipoSancion(enum.Enum):
    MULTA = "MULTA"            # usa `monto`
    SUSPENSION = "SUSPENSION"  # usa `dias_suspension`
