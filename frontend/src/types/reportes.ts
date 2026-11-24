/** Respuestas de los endpoints /api/v1/reportes (admin). */

export type FiltroFechas = { desde?: string; hasta?: string };

export interface DisponibilidadSede {
  sede_id: number;
  sede: string;
  disponibles: number;
  total: number;
  porcentaje: number;
}

export interface EficaciaLogistica {
  creados: number;
  en_transito: number;
  recibidos: number;
  con_incidencia: number;
  finalizados: number;
  tasa_exito_porcentaje: number;
}

export interface MovimientoSede {
  origen: string;
  destino: string;
  remitos: number;
  ejemplares: number;
  dias_promedio: number | null;
}

export interface LibroSolicitado {
  libro_id: number;
  libro: string;
  cantidad: number;
}

export interface EstadoColeccion {
  estado: string;
  cantidad: number;
  porcentaje: number;
}

export interface CumplimientoRetiro {
  cumplidas: number;
  vencidas: number;
  canceladas: number;
  tasa_cumplimiento_porcentaje: number;
}

export interface EsperaReserva {
  sede_id: number;
  sede: string;
  reservas: number;
  dias_promedio: number | null;
}

export interface CargaSede {
  sede_id: number;
  sede: string;
  prestamos_activos: number;
  remitos_en_transito: number;
  ejemplares_en_transito: number;
}

export interface MultaSocio {
  socio_id: number;
  socio: string;
  cantidad: number;
  monto_total: number;
}

export interface MultasAcumuladas {
  total: number;
  socios: MultaSocio[];
}

export interface PresionLibro {
  libro_id: number;
  libro: string;
  reservas_esperando: number;
  ejemplares: number;
  ratio: number;
}

export interface UsoGeneroSede {
  genero: string;
  sede: string;
  prestamos: number;
}

export interface VencidoSinSancion {
  numero: string;
  socio: string;
  libro: string;
  fecha_vencimiento: string;
}

export interface VencidosSinSancion {
  cantidad: number;
  prestamos: VencidoSinSancion[];
}
