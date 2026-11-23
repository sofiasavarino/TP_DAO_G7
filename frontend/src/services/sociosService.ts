import { api } from './api';
import type { PrestamoListado } from '../types/mostrador';
import type { Sancion, SancionPayload, Socio } from '../types/socios';

export const sociosService = {
  /** Padrón completo con su estado (GET /api/v1/socios sin `q`). */
  listar: () => api.get<Socio[]>('/api/v1/socios'),

  /** Todos los préstamos (para marcar a los socios con préstamos vencidos). */
  prestamos: () => api.get<PrestamoListado[]>('/api/v1/prestamos'),

  /** Sanciones vigentes hoy de toda la red. */
  sancionesVigentes: () => api.get<Sancion[]>('/api/v1/sanciones'),

  /** Aplica una MULTA (con monto) o SUSPENSION (con días) sobre un préstamo del socio. */
  sancionar: (payload: SancionPayload, usuarioId: number) =>
    api.post<Sancion>(`/api/v1/sanciones?responsable_id=${usuarioId}`, payload),

  /** Levanta (perdona) una sanción vigente: el socio vuelve a quedar habilitado. */
  levantar: (sancionId: number, usuarioId: number) =>
    api.put<Sancion>(`/api/v1/sanciones/${sancionId}/levantar?responsable_id=${usuarioId}`),
};
