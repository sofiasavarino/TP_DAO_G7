import { api } from './api';
import type {
  CargaSede,
  CumplimientoRetiro,
  DisponibilidadSede,
  EficaciaLogistica,
  EstadoColeccion,
  EsperaReserva,
  FiltroFechas,
  LibroSolicitado,
  MovimientoSede,
  MultasAcumuladas,
  PresionLibro,
  UsoGeneroSede,
  VencidosSinSancion,
} from '../types/reportes';

/** Todos los reportes son GET y requieren rol Administrador (lo valida el backend). */
export const reportesService = {
  disponibilidad: (libroId?: number) =>
    api.get<DisponibilidadSede[]>('/api/v1/reportes/disponibilidad', { libro_id: libroId }),

  eficacia: (filtro: FiltroFechas) =>
    api.get<EficaciaLogistica>('/api/v1/reportes/eficacia-logistica', filtro),

  movimientos: (filtro: FiltroFechas) =>
    api.get<MovimientoSede[]>('/api/v1/reportes/movimientos', filtro),

  librosSolicitados: (limite = 10) =>
    api.get<LibroSolicitado[]>('/api/v1/reportes/libros-solicitados', { limite }),

  saludColeccion: () => api.get<EstadoColeccion[]>('/api/v1/reportes/salud-coleccion'),

  cumplimiento: (filtro: FiltroFechas) =>
    api.get<CumplimientoRetiro>('/api/v1/reportes/cumplimiento-retiro', filtro),

  esperaReservas: (filtro: FiltroFechas) =>
    api.get<EsperaReserva[]>('/api/v1/reportes/espera-reservas', filtro),

  cargaOperativa: () => api.get<CargaSede[]>('/api/v1/reportes/carga-operativa'),

  multas: (filtro: FiltroFechas) =>
    api.get<MultasAcumuladas>('/api/v1/reportes/multas', filtro),

  presionLibros: (limite = 10) =>
    api.get<PresionLibro[]>('/api/v1/reportes/presion-libros', { limite }),

  usoGenero: (filtro: FiltroFechas) =>
    api.get<UsoGeneroSede[]>('/api/v1/reportes/uso-genero', filtro),

  vencidosSinSancion: () =>
    api.get<VencidosSinSancion>('/api/v1/reportes/vencidos-sin-sancion'),
};
