// Tipos de la pantalla de Remitos (F8.1 / F8.2). Espejo de backend/app/dtos/remito_dto.py.
import { EjemplarEstado, MotivoTraslado, RemitoEstado } from './enums';

/** GET /api/v1/remitos, /de-despacho, /de-recepcion, /con-incidencia (RemitoListadoDTO) */
export interface RemitoListado {
  id: number;
  numero_remito: string;
  motivo_traslado: MotivoTraslado;
  estado: RemitoEstado;
  sede_origen_id: number;
  sede_destino_id: number;
  ejemplares_count: number;
  fecha_creacion: string;
  fecha_despacho: string | null;
  fecha_recepcion: string | null;
}

/** Ejemplar dentro del detalle de un remito (EjemplarEnRemitoDTO) */
export interface EjemplarEnRemito {
  id: number;
  codigo_inventario: string;
  descripcion_fisica: string | null;
  libro_nombre: string;
}

/** GET /api/v1/remitos/{id} y respuesta de crear / despachar / recibir (RemitoDetalleDTO) */
export interface RemitoDetalle extends Omit<RemitoListado, 'ejemplares_count'> {
  observaciones: string | null;
  responsable_creacion_id: number;
  responsable_despacho_id: number | null;
  responsable_recepcion_id: number | null;
  ejemplares: EjemplarEnRemito[];
}

/** Cuerpo de POST /api/v1/remitos (RemitoCreate). El número lo genera el backend. */
export interface RemitoPayload {
  motivo_traslado: MotivoTraslado;
  sede_origen_id: number;
  sede_destino_id: number;
  ejemplar_ids: number[];
  observaciones: string | null;
}

/** Ejemplar que llegó dañado (IncidenciaItemDTO). */
export interface IncidenciaItem {
  ejemplar_id: number;
  estado: EjemplarEstado.EN_REPARACION | EjemplarEstado.INUTILIZABLE;
}

export const ETIQUETA_ESTADO_REMITO: Record<RemitoEstado, string> = {
  [RemitoEstado.CREADO]: 'Creado',
  [RemitoEstado.EN_TRANSITO]: 'En tránsito',
  [RemitoEstado.RECIBIDO]: 'Recibido',
  [RemitoEstado.CON_INCIDENCIA]: 'Con incidencia',
};

/** Clase de color de estado-pill (mismo sistema --est que los ejemplares). */
export const CLASE_ESTADO_REMITO: Record<RemitoEstado, string> = {
  [RemitoEstado.CREADO]: 'est-creado',
  [RemitoEstado.EN_TRANSITO]: 'est-en_transito',
  [RemitoEstado.RECIBIDO]: 'est-recibido',
  [RemitoEstado.CON_INCIDENCIA]: 'est-con_incidencia',
};

export const ETIQUETA_MOTIVO: Record<MotivoTraslado, string> = {
  [MotivoTraslado.IDA]: 'Ida',
  [MotivoTraslado.REBALANCEO]: 'Rebalanceo',
};

export const AYUDA_MOTIVO: Record<MotivoTraslado, string> = {
  [MotivoTraslado.IDA]: 'Envío a otra sede (p. ej. para cumplir una reserva)',
  [MotivoTraslado.REBALANCEO]: 'Redistribuir stock entre sedes',
};
