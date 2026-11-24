// // Tipos de la pantalla de Socios y Sanciones (F8.3 / F8.4).
// // Espejo de backend/app/dtos/socio_dto.py y sancion_dto.py.
// import { SancionTipo, SocioEstado } from './enums';

// /** GET /api/v1/socios (SocioDTO) */
// export interface Socio {
//   id: number;
//   nombre: string;
//   apellido: string;
//   dni: string;
//   telefono: string | null;
//   estado: SocioEstado;
// }

// /** GET /api/v1/sanciones (SancionDTO). El backend además tiene REPOSICION (baja por pérdida). */
// export interface Sancion {
//   id: number;
//   tipo: SancionTipo | 'REPOSICION';
//   motivo: string;
//   monto: number | null;
//   dias_suspension: number | null;
//   fecha_inicio: string;
//   fecha_fin: string | null;
//   socio_id: number;
//   prestamo_id: number;
// }

// /** Cuerpo de POST /api/v1/sanciones (SancionCreate): la sanción siempre va atada a un préstamo. */
// export interface SancionPayload {
//   prestamo_id: number;
//   tipo: SancionTipo;
//   motivo: string;
//   monto: number | null;
//   dias_suspension: number | null;
// }

// export const ETIQUETA_ESTADO_SOCIO: Record<SocioEstado, string> = {
//   [SocioEstado.ACTIVO]: 'Activo',
//   [SocioEstado.SUSPENDIDO]: 'Suspendido',
//   [SocioEstado.BAJA]: 'Baja',
// };

// export const ETIQUETA_SANCION: Record<Sancion['tipo'], string> = {
//   [SancionTipo.MULTA]: 'Multa',
//   [SancionTipo.SUSPENSION]: 'Suspensión',
//   REPOSICION: 'Reposición',
// };

// Tipos de la pantalla de Socios y Sanciones (F8.3 / F8.4).
// Espejo de backend/app/dtos/socio_dto.py y sancion_dto.py.
import { SancionTipo, SocioEstado } from './enums';

/** GET /api/v1/socios (SocioDTO) */
export interface Socio {
  id: number;
  usuario_id?: number | null;
  nombre_usuario?: string | null;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string | null;
  estado: SocioEstado;
}

/** GET /api/v1/sanciones (SancionDTO): MULTA, SUSPENSION y REPOSICION (baja por pérdida). */
export interface Sancion {
  id: number;
  tipo: SancionTipo;
  motivo: string;
  monto: number | null;
  dias_suspension: number | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  socio_id: number;
  prestamo_id: number;
}

/** Cuerpo de POST /api/v1/sanciones (SancionCreate): la sanción siempre va atada a un préstamo. */
export interface SancionPayload {
  prestamo_id: number;
  tipo: SancionTipo;
  motivo: string;
  monto: number | null;
  dias_suspension: number | null;
}

export const ETIQUETA_ESTADO_SOCIO: Record<SocioEstado, string> = {
  [SocioEstado.ACTIVO]: 'Activo',
  [SocioEstado.SUSPENDIDO]: 'Suspendido',
  [SocioEstado.BAJA]: 'Baja',
  [SocioEstado.PENDIENTE_CUOTA]: 'Pendiente de cuota',
};

export const ETIQUETA_SANCION: Record<Sancion['tipo'], string> = {
  [SancionTipo.MULTA]: 'Multa',
  [SancionTipo.SUSPENSION]: 'Suspensión',
  [SancionTipo.REPOSICION]: 'Reposición',
};
