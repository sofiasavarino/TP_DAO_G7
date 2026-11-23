import { api } from './api';
import type { AccionEjemplar, EjemplarInventario, EjemplarLotePayload, Sede } from '../types/ejemplares';
import type { EjemplarEstado } from '../types/enums';

const BASE = '/api/v1/ejemplares';

export interface FiltroInventario {
  libro_id?: number;
  sede_id?: number;
  estado?: EjemplarEstado;
}

export const ejemplaresService = {
  /** Inventario físico (todos los estados), filtrable por libro, sede actual y estado. */
  listar: (filtros: FiltroInventario = {}) =>
    api.get<EjemplarInventario[]>(BASE, filtros as Record<string, string | number | undefined>),

  /** Alta de 1..50 copias de un libro en una sede (los códigos se generan solos). */
  crearLote: (payload: EjemplarLotePayload) => api.post<EjemplarInventario[]>(`${BASE}/lote`, payload),

  /** reparacion: DISPONIBLE→EN_REPARACION · reincorporacion: EN_REPARACION→DISPONIBLE · inutilizable: terminal */
  aplicarAccion: (id: number, accion: AccionEjemplar) =>
    api.patch<EjemplarInventario>(`${BASE}/${id}/${accion}`),
};

export const sedesService = {
  listar: () => api.get<Sede[]>('/api/v1/sedes'),
};
