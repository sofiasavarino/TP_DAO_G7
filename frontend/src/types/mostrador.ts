// Tipos de la pantalla de Mostrador (F7). Espejo de backend/app/dtos/prestamo_dto.py,
// reserva_dto.py y sancion_dto.py. Cuando se regenere src/api/schema.d.ts con
// `npm run gen:types` se pueden reemplazar por components['schemas'][...].
import { PrestamoEstado, PrestamoTipo, ReservaEstado } from './enums';

/** GET /api/v1/prestamos (PrestamoListadoDTO) */
export interface PrestamoListado {
  id: number;
  numero: string;
  estado: PrestamoEstado;
  tipo: PrestamoTipo;
  /** ISO yyyy-mm-dd */
  fecha_inicio: string;
  /** ISO yyyy-mm-dd */
  fecha_vencimiento: string;
  socio_id: number;
  socio_nombre: string;
  ejemplar_id: number;
  ejemplar_codigo: string;
}

/** Respuesta de POST /prestamos, PUT /prestamos/{id}/devolucion y POST /reservas/{id}/retira (PrestamoDTO) */
export interface Prestamo {
  id: number;
  numero: string;
  tipo: PrestamoTipo;
  estado: PrestamoEstado;
  socio_id: number;
  ejemplar_id: number;
  fecha_inicio: string;
  fecha_vencimiento: string;
  fecha_devolucion: string | null;
  observaciones: string | null;
}

/** Cuerpo de POST /api/v1/prestamos (PrestamoCreate) */
export interface PrestamoPayload {
  socio_id: number;
  ejemplar_id: number;
  observaciones: string | null;
}

/**
 * Reserva lista para retirar (ReservaDTO). Los campos opcionales de abajo NO están en el
 * ReservaDTO actual: si el endpoint nuevo los manda (DTO enriquecido) se usan; si no, la
 * pantalla los completa cruzando con el catálogo y el inventario, o muestra "Socio #id".
 */
export interface ReservaListaRetiro {
  id: number;
  fecha_reserva: string;
  fecha_asignacion: string | null;
  fecha_vencimiento_retiro: string | null;
  estado: ReservaEstado;
  socio_id: number;
  libro_id: number;
  sede_retiro_id: number;
  ejemplar_id: number | null;
  socio_nombre?: string | null;
  socio_dni?: string | null;
  libro_nombre?: string | null;
  ejemplar_codigo?: string | null;
}

/** Resultado esperado de la búsqueda de socios (endpoint pendiente, ver mostradorService). */
export interface SocioBusqueda {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  email?: string | null;
  estado?: string;
}

/** GET /api/v1/sanciones/{socio_id} (SancionDTO): sanciones vigentes hoy */
export interface SancionVigente {
  id: number;
  tipo: string;
  motivo: string;
  monto: number | null;
  dias_suspension: number | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  socio_id: number;
  prestamo_id: number;
}

/**
 * Tope de préstamos abiertos por socio. Copia de MAX_PRESTAMOS_ABIERTOS en
 * backend/app/services/prestamo_service.py: solo se usa para AVISAR antes de prestar;
 * la validación real la hace el backend.
 */
export const MAX_PRESTAMOS_ABIERTOS = 2;

/**
 * Días de un préstamo y de su renovación. Copia de DIAS_PRESTAMO en prestamo_service.py.
 * Un préstamo se puede renovar una sola vez: si ya vence más de DIAS_PRESTAMO días después
 * de su inicio, es porque se renovó (la validación real la hace el backend).
 */
export const DIAS_PRESTAMO = 15;

export function yaRenovado(p: { fecha_inicio: string; fecha_vencimiento: string }): boolean {
  const dias = (Date.parse(p.fecha_vencimiento) - Date.parse(p.fecha_inicio)) / 86_400_000;
  return Math.round(dias) > DIAS_PRESTAMO;
}

export const ETIQUETA_TIPO_PRESTAMO: Record<PrestamoTipo, string> = {
  [PrestamoTipo.LOCAL]: 'Local',
  [PrestamoTipo.INTERBIBLIOTECARIO]: 'Interbibliotecario',
};

export const ETIQUETA_ESTADO_PRESTAMO: Record<PrestamoEstado, string> = {
  [PrestamoEstado.ACTIVO]: 'Activo',
  [PrestamoEstado.VENCIDO]: 'Vencido',
  [PrestamoEstado.FINALIZADO]: 'Finalizado',
};
