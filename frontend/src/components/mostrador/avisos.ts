import { ApiError } from '../../services/api';

/** Aviso de la barra superior del mostrador (mismo formato que en EjemplaresPage). */
export type Aviso = { tipo: 'ok' | 'error'; texto: string };

export function mensajeDeError(e: unknown, porDefecto: string): string {
  if (e instanceof ApiError) return e.message;
  return `${porDefecto} Verificá que el backend esté levantado.`;
}
