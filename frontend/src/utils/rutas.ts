import { RolNombre } from '../types/enums';

export const RUTA_LOGIN = '/login';
export const RUTA_PORTAL_SOCIO = '/';
export const RUTA_GESTION = '/gestion';

/** Pantalla inicial según el rol: el Socio al portal, el personal al panel de gestión. */
export function rutaInicialPorRol(rol: RolNombre): string {
  return rol === RolNombre.SOCIO ? RUTA_PORTAL_SOCIO : RUTA_GESTION;
}