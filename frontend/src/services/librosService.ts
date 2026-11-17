import { api } from './api';

export interface FiltroLibrosParams {
  titulo?: string;
  autor?: string;
  isbn?: string;
  sede_id?: number;
}

export const librosService = {
  // Ajustar la ruta '/libros' si en Swagger (/docs) figura con prefijo '/api/libros'
  listar: (filtros?: FiltroLibrosParams) =>
    api.get<any[]>('/libros', filtros as Record<string, string | number | undefined>),

  obtenerPorId: (id: number) =>
    api.get<any>(`/libros/${id}`),

  buscarPorIsbn: (isbn: string) =>
    api.get<any>(`/libros/isbn/${isbn}`),

  disponibilidadPorSede: (libroId: number) =>
    api.get<any[]>(`/libros/${libroId}/disponibilidad`),
};