import { api } from './api';

export interface CrearReservaPayload {
  libro_id: number;
  sede_retiro_id: number;
}

export const reservasService = {
  misReservas: () =>
    api.get<any[]>('/reservas/mias'),

  crear: (payload: CrearReservaPayload) =>
    api.post<any>('/reservas', payload),

  cancelar: (reservaId: number) =>
    api.patch<any>(`/reservas/${reservaId}/cancelar`),
};