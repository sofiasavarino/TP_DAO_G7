import { api } from './api';
import type { Reserva, ReservaEta, ReservaPayload } from '../types/reservas';

const BASE = '/api/v1/reservas';

export const reservasService = {
  /**
   * Alta de reserva con sede de retiro. `responsableId` es el usuario que la registra
   * (en el portal, el propio socio). Errores de negocio que devuelve el backend:
   * 409 sanción vigente / límite de libros / reserva duplicada, 400 socio no activo.
   */
  crear: (payload: ReservaPayload, responsableId: number) =>
    api.request<Reserva>(BASE, {
      method: 'POST',
      body: JSON.stringify(payload),
      params: { responsable_creacion_id: responsableId },
    }),

  /** Vista previa: ¿hay copia ya en esa sede o para cuándo se estima? */
  eta: (libroId: number, sedeRetiroId: number) =>
    api.get<ReservaEta>(`${BASE}/eta`, { libro_id: libroId, sede_retiro_id: sedeRetiroId }),

  /** Reservas del socio (cualquier estado), de la más reciente a la más vieja. */
  mias: (socioId: number) => api.get<Reserva[]>(`${BASE}/mios`, { socio_id: socioId }),

  cancelar: (reservaId: number, responsableId: number) =>
    api.request<Reserva>(`${BASE}/${reservaId}`, {
      method: 'DELETE',
      params: { responsable_cancelacion_id: responsableId },
    }),
};
