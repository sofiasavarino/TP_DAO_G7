// Tipos del inventario físico (espejo de backend/app/dtos/ejemplar_dto.py y sede_dto.py).
import { EjemplarEstado } from './enums';

export interface Sede {
  id: number;
  nombre: string;
  direccion: string;
  telefono: string | null;
  email: string | null;
  horario_atencion: string | null;
  activo: boolean;
}

/** GET /api/v1/ejemplares */
export interface EjemplarInventario {
  id: number;
  codigo_inventario: string;
  signatura_topografica: string | null;
  descripcion_fisica: string | null;
  estado: EjemplarEstado;
  libro_id: number;
  sede_actual_id: number;
  sede_origen_id: number;
  libro: { id: number; nombre: string; isbn: string | null; imagen_url: string | null };
  sede_actual: { id: number; nombre: string };
  sede_origen: { id: number; nombre: string };
}

/** POST /api/v1/ejemplares/lote */
export interface EjemplarLotePayload {
  libro_id: number;
  sede_id: number;
  cantidad: number;
  codigo_inventario: string | null;
  signatura_topografica: string | null;
  descripcion_fisica: string | null;
}

/** Acciones manuales (F6.3) y su endpoint PATCH /api/v1/ejemplares/{id}/<ruta>. */
export type AccionEjemplar = 'reparacion' | 'reincorporacion' | 'inutilizable';

/** Etiqueta legible de cada estado. */
export const ETIQUETA_ESTADO: Record<EjemplarEstado, string> = {
  [EjemplarEstado.DISPONIBLE]: 'Disponible',
  [EjemplarEstado.RESERVADO]: 'Reservado',
  [EjemplarEstado.EN_TRANSITO]: 'En tránsito',
  [EjemplarEstado.PRESTADO]: 'Prestado',
  [EjemplarEstado.EN_REPARACION]: 'En reparación',
  [EjemplarEstado.INUTILIZABLE]: 'Inutilizable',
};

/**
 * Acciones permitidas según el estado (mismas reglas que ACCIONES_MANUALES en
 * backend/app/services/ejemplar_service.py). Los estados sin acciones los cambian
 * otros módulos: reservas, préstamos y remitos.
 */
export const ACCIONES_POR_ESTADO: Record<EjemplarEstado, AccionEjemplar[]> = {
  [EjemplarEstado.DISPONIBLE]: ['reparacion', 'inutilizable'],
  [EjemplarEstado.EN_REPARACION]: ['reincorporacion', 'inutilizable'],
  [EjemplarEstado.RESERVADO]: [],
  [EjemplarEstado.EN_TRANSITO]: [],
  [EjemplarEstado.PRESTADO]: [],
  [EjemplarEstado.INUTILIZABLE]: [],
};

/** Por qué una copia no tiene acciones manuales (se muestra como ayuda en la fila). */
export const MOTIVO_SIN_ACCIONES: Partial<Record<EjemplarEstado, string>> = {
  [EjemplarEstado.RESERVADO]: 'Se libera al retirarse o vencer la reserva',
  [EjemplarEstado.EN_TRANSITO]: 'Cambia al recibir el remito',
  [EjemplarEstado.PRESTADO]: 'Cambia con la devolución',
  [EjemplarEstado.INUTILIZABLE]: 'Estado final',
};
