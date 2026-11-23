import { api } from './api';
import { esEndpointFaltante } from './mostradorService';
import type { RemitoEstado } from '../types/enums';
import type { IncidenciaItem, RemitoDetalle, RemitoListado, RemitoPayload } from '../types/remitos';

const BASE = '/api/v1/remitos';

/**
 * Listado general. Usa GET /api/v1/remitos; si ese endpoint todavía no existe en el backend,
 * arma la lista con los tres tableros que sí existen (sin los RECIBIDO).
 * `completo` indica si la lista incluye todos los estados.
 */
async function listar(): Promise<{ remitos: RemitoListado[]; completo: boolean }> {
  try {
    return { remitos: await api.get<RemitoListado[]>(BASE), completo: true };
  } catch (e) {
    if (!esEndpointFaltante(e)) throw e;
    const partes = await Promise.all([
      api.get<RemitoListado[]>(`${BASE}/de-despacho`),
      api.get<RemitoListado[]>(`${BASE}/de-recepcion`),
      api.get<RemitoListado[]>(`${BASE}/con-incidencia`),
    ]);
    const remitos = partes.flat().sort((a, b) => b.fecha_creacion.localeCompare(a.fecha_creacion) || b.id - a.id);
    return { remitos, completo: false };
  }
}

export const remitosService = {
  listar,

  listarPorEstado: (estado: RemitoEstado) => api.get<RemitoListado[]>(BASE, { estado }),

  obtener: (id: number) => api.get<RemitoDetalle>(`${BASE}/${id}`),

  /** Alta (queda CREADO). El N° de remito lo genera el backend. */
  crear: (payload: RemitoPayload, usuarioId: number) =>
    api.post<RemitoDetalle>(`${BASE}?responsable_creacion_id=${usuarioId}`, payload),

  /** CREADO -> EN_TRANSITO */
  despachar: (id: number, usuarioId: number) =>
    api.put<RemitoDetalle>(`${BASE}/${id}/despacho?responsable_despacho_id=${usuarioId}`),

  /** EN_TRANSITO -> RECIBIDO, o CON_INCIDENCIA si se informan ejemplares dañados. */
  recibir: (id: number, usuarioId: number, incidencias: IncidenciaItem[], observaciones: string | null) => {
    const q = new URLSearchParams({ responsable_recepcion_id: String(usuarioId) });
    if (observaciones) q.set('observaciones', observaciones);
    return api.put<RemitoDetalle>(`${BASE}/${id}/recepcion?${q.toString()}`, incidencias.length ? incidencias : undefined);
  },
};
