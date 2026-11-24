import type { RolNombre } from './enums';

/** Respuesta de GET /api/v1/auth/me */
export interface UsuarioSesion {
  id: number;
  nombre_usuario: string;
  activo: boolean;
  rol: { id: number; nombre: RolNombre; descripcion: string | null };
  sede: { id: number; nombre: string };
  nombre: string | null;
  apellido: string | null;
  socio_id: number | null;
  empleado_id: number | null;
  email: string | null;
  telefono?: string | null;
}