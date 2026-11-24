import { RolNombre } from '../types/enums';

export const RUTA_LOGIN = '/login';
export const RUTA_REGISTRO = '/registro';
export const RUTA_PORTAL_SOCIO = '/';
export const RUTA_GESTION = '/gestion';

/** Pantalla inicial según el rol: el Socio al portal, el personal al panel de gestión. */
export function rutaInicialPorRol(rol: RolNombre): string {
  return rol === RolNombre.SOCIO ? RUTA_PORTAL_SOCIO : RUTA_GESTION;
}
/** Secciones del panel de gestión (hijas de RUTA_GESTION). */
export const RUTAS_GESTION = {
  catalogo: `${RUTA_GESTION}/catalogo`,
  ejemplares: `${RUTA_GESTION}/ejemplares`,
  mostrador: `${RUTA_GESTION}/mostrador`,
  remitos: `${RUTA_GESTION}/remitos`,
  socios: `${RUTA_GESTION}/socios`,
  personal: `${RUTA_GESTION}/personal`,
  reportes: `${RUTA_GESTION}/reportes`,
} as const;
