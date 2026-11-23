import { api } from './api';
import type { Notificacion, PrestamoSocio, Sancion } from '../types/socio';

export const prestamosService = {
  /** Préstamos del socio (actuales e históricos), del más reciente al más viejo. */
  mios: (socioId: number) => api.get<PrestamoSocio[]>('/api/v1/prestamos/mios', { socio_id: socioId }),
};

export const sancionesService = {
  /** Sanciones vigentes hoy del socio (multas sin abonar, suspensiones, reposiciones). */
  vigentes: (socioId: number) => api.get<Sancion[]>('/api/v1/sanciones', { socio_id: socioId }),
};

const NOTIF = '/api/v1/notificaciones';

/** Las notificaciones son del USUARIO (usuario.id), no del socio (socio_id). */
export const notificacionesService = {
  mias: (usuarioId: number) => api.get<Notificacion[]>(`${NOTIF}/mios`, { usuario_id: usuarioId }),

  cantidadNoLeidas: (usuarioId: number) =>
    api.get<{ cantidad: number }>(`${NOTIF}/mios/no-leidas/cantidad`, { usuario_id: usuarioId }),

  marcarLeida: (id: number, usuarioId: number) =>
    api.request<Notificacion>(`${NOTIF}/${id}/leida`, { method: 'PUT', params: { usuario_id: usuarioId } }),

  marcarTodasLeidas: (usuarioId: number) =>
    api.request<{ marcadas: number }>(`${NOTIF}/mios/leidas`, { method: 'PUT', params: { usuario_id: usuarioId } }),
};
