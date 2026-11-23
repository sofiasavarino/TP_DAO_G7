// Tipos del panel personal del socio (espejo de backend/app/dtos/prestamo_dto.py,
// sancion_dto.py y notificacion_dto.py).
import type { NotificacionTipo, PrestamoEstado, PrestamoTipo, SancionTipo } from './enums';

/** GET /api/v1/prestamos/mios?socio_id= */
export interface PrestamoSocio {
  id: number;
  numero: string;
  estado: PrestamoEstado;
  tipo: PrestamoTipo;
  /** ISO yyyy-mm-dd */
  fecha_inicio: string;
  fecha_vencimiento: string;
  fecha_devolucion: string | null;
  socio_id: number;
  socio_nombre: string;
  ejemplar_id: number;
  ejemplar_codigo: string;
  libro_id: number;
  libro_nombre: string;
  libro_isbn: string | null;
  libro_imagen_url: string | null;
}

/** GET /api/v1/sanciones?socio_id= (solo las vigentes hoy) */
export interface Sancion {
  id: number;
  tipo: SancionTipo;
  motivo: string;
  monto: number | null;
  dias_suspension: number | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  socio_id: number;
  prestamo_id: number;
}

/** GET /api/v1/notificaciones/mios?usuario_id= */
export interface Notificacion {
  id: number;
  tipo: NotificacionTipo;
  titulo: string;
  cuerpo: string;
  leida: boolean;
  /** ISO datetime */
  fecha_creacion: string;
}
