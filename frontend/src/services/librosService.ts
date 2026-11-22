import { api } from './api';
import type { Libro, LibroGoogle, LibroListado, LibroPayload } from '../types/libros';

const BASE = '/api/v1/libros';

export interface FiltroLibrosParams {
  titulo?: string;
  autor?: string;
  isbn?: string;
  genero?: string;
  orden?: 'default' | 'populares' | 'recientes';
}

export const librosService = {
  /** Catálogo de libros activos (los dados de baja no aparecen). */
  listar: (filtros?: FiltroLibrosParams) =>
    api.get<LibroListado[]>(`${BASE}/catalogo`, filtros as Record<string, string | undefined>),

  obtenerPorId: (id: number) => api.get<Libro>(`${BASE}/catalogo/${id}`),

  /** Autocompletado por ISBN: base local → Google Books → MANUAL. */
  lookupPorIsbn: (isbn: string) => api.get<LibroGoogle>(`${BASE}/lookup`, { isbn }),

  /** Proxy a Google Books por título, autor o ISBN (requiere Bibliotecario/Administrador). */
  buscarEnGoogle: (q: string, maxResultados = 12) =>
    api.get<LibroGoogle[]>(`${BASE}/google`, { q, max_resultados: maxResultados }),

  /** Alta. Si el ISBN ya existía devuelve ese libro (y lo reactiva si estaba de baja). */
  crear: (payload: LibroPayload) => api.post<Libro>(BASE, payload),

  actualizar: (id: number, payload: LibroPayload) => api.put<Libro>(`${BASE}/${id}`, payload),

  /** Baja lógica (activo = false). */
  darDeBaja: (id: number) => api.patch<Libro>(`${BASE}/${id}/baja`),
};
