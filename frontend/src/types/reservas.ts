// // Tipos de reservas (espejo de backend/app/dtos/reserva_dto.py).
// import { ReservaEstado } from './enums';

// /** Respuesta de POST /api/v1/reservas y GET /api/v1/reservas/mios */
// export interface Reserva {
//   id: number;
//   /** ISO yyyy-mm-dd */
//   fecha_reserva: string;
//   fecha_asignacion: string | null;
//   /** Último día para retirar (2 días hábiles desde la asignación). */
//   fecha_vencimiento_retiro: string | null;
//   estado: ReservaEstado;
//   socio_id: number;
//   libro_id: number;
//   sede_retiro_id: number;
//   /** Copia pre-asignada (puede estar viajando desde otra sede). */
//   ejemplar_id: number | null;
// }

// /** Cuerpo de POST /api/v1/reservas */
// export interface ReservaPayload {
//   socio_id: number;
//   libro_id: number;
//   sede_retiro_id: number;
// }

// /** GET /api/v1/reservas/eta: vista previa antes de reservar (no crea nada). */
// export interface ReservaEta {
//   libro_id: number;
//   sede_retiro_id: number;
//   disponible_ahora: boolean;
//   /** Fecha mínima estimada, o null si no hay nada estimable (lista de espera). */
//   eta: string | null;
// }

// /** Reservas que siguen ocupando cupo (las mismas que ESTADOS_VIGENTES del backend). */
// export const ESTADOS_RESERVA_VIVA: ReservaEstado[] = [
//   ReservaEstado.PENDIENTE,
//   ReservaEstado.EN_TRANSITO,
//   ReservaEstado.LISTA_PARA_RETIRO,
// ];

// Tipos de reservas (espejo de backend/app/dtos/reserva_dto.py).
import { ReservaEstado } from './enums';

/** Respuesta de POST /api/v1/reservas y GET /api/v1/reservas/mios */
export interface Reserva {
  id: number;
  /** ISO yyyy-mm-dd */
  fecha_reserva: string;
  fecha_asignacion: string | null;
  /** Último día para retirar (2 días hábiles desde la asignación). */
  fecha_vencimiento_retiro: string | null;
  estado: ReservaEstado;
  socio_id: number;
  libro_id: number;
  sede_retiro_id: number;
  /** Copia pre-asignada (puede estar viajando desde otra sede). */
  ejemplar_id: number | null;
  aviso?: string | null;
}

/** Cuerpo de POST /api/v1/reservas */
export interface ReservaPayload {
  socio_id: number;
  libro_id: number;
  sede_retiro_id: number;
}

/** GET /api/v1/reservas/eta: vista previa antes de reservar (no crea nada). */
export interface ReservaEta {
  libro_id: number;
  sede_retiro_id: number;
  disponible_ahora: boolean;
  /** Fecha mínima estimada, o null si no hay nada estimable (lista de espera). */
  eta: string | null;
}

/** Reservas que siguen ocupando cupo (las mismas que ESTADOS_VIGENTES del backend). */
export const ESTADOS_RESERVA_VIVA: ReservaEstado[] = [
  ReservaEstado.PENDIENTE,
  ReservaEstado.EN_TRANSITO,
  ReservaEstado.LISTA_PARA_RETIRO,
];