// Roles de usuario del sistema
export enum RolNombre {
  SOCIO = 'Socio',
  BIBLIOTECARIO = 'Bibliotecario',
  ADMINISTRADOR = 'Administrador',
}

// Estados de un ejemplar físico (inventario flotante)
export enum EjemplarEstado {
  DISPONIBLE = 'DISPONIBLE',
  RESERVADO = 'RESERVADO',
  EN_TRANSITO = 'EN_TRANSITO',
  PRESTADO = 'PRESTADO',
  EN_REPARACION = 'EN_REPARACION',
  INUTILIZABLE = 'INUTILIZABLE',
}

// Estados de una reserva
export enum ReservaEstado {
  PENDIENTE = 'PENDIENTE',
  EN_TRANSITO = 'EN_TRANSITO', 
  LISTA_PARA_RETIRO = 'LISTA_PARA_RETIRO',
  CUMPLIDA = 'CUMPLIDA',
  VENCIDA = 'VENCIDA',
  CANCELADA = 'CANCELADA',
}

// Estados y tipos de un préstamo
export enum PrestamoEstado {
  ACTIVO = 'ACTIVO',
  VENCIDO = 'VENCIDO',
  FINALIZADO = 'FINALIZADO',
}

export enum PrestamoTipo {
  LOCAL = 'LOCAL',
  INTERBIBLIOTECARIO = 'INTERBIBLIOTECARIO',
}

// Estados y motivo de traslado de un remito
export enum RemitoEstado {
  CREADO = 'CREADO',
  EN_TRANSITO = 'EN_TRANSITO',
  RECIBIDO = 'RECIBIDO',
  CON_INCIDENCIA = 'CON_INCIDENCIA',
}

export enum MotivoTraslado {
  IDA = 'IDA',
  REBALANCEO = 'REBALANCEO',
}

// Estados de un socio
export enum SocioEstado {
  ACTIVO = 'ACTIVO',
  SUSPENDIDO = 'SUSPENDIDO',
  BAJA = 'BAJA',
}

// Tipos de sanción
export enum SancionTipo {
  MULTA = 'MULTA',
  SUSPENSION = 'SUSPENSION',
  /** Baja del socio hasta regularizar el libro perdido: reponerlo (igual o edición posterior) o devolverlo y pagar la multa. */
  REPOSICION = 'REPOSICION',
}

// Tipos de notificación al usuario
export enum NotificacionTipo {
  RESERVA_LISTA = 'RESERVA_LISTA',
  RESERVA_VENCIDA = 'RESERVA_VENCIDA',
  SANCION_APLICADA = 'SANCION_APLICADA',
  SANCION_LEVANTADA = 'SANCION_LEVANTADA',
  EJEMPLAR_ASIGNADO = 'EJEMPLAR_ASIGNADO',
  PASSWORD_REESTABLECIDA = 'PASSWORD_REESTABLECIDA',
}