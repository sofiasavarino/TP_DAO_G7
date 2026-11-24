import { api } from './api';
import type { UsuarioSesion } from '../types/auth';
import type {
  EmpleadoListado,
  RegistroBibliotecarioPayload,
  RegistroSocioPayload,
  Sede,
} from '../types/usuarios';

export const usuariosService = {
  /** Sedes activas (público): para elegir sede al registrarse o al dar de alta personal. */
  listarSedes: () => api.get<Sede[]>('/api/v1/sedes'),

  /** Autorregistro de socio (público). No inicia sesión: después hay que llamar a login. */
  registrarSocio: (payload: RegistroSocioPayload) =>
    api.post<UsuarioSesion>('/api/v1/auth/registro', payload),

  /** Solo Administrador. */
  listarBibliotecarios: () => api.get<EmpleadoListado[]>('/api/v1/usuarios/bibliotecarios'),

  /** Solo Administrador. */
  registrarBibliotecario: (payload: RegistroBibliotecarioPayload) =>
    api.post<EmpleadoListado>('/api/v1/usuarios/bibliotecarios', payload),

  actualizarPerfil: (payload: {
    nombre_usuario: string;
    email: string;
    telefono: string | null;
    sede_id: number;
  }) =>
    api.request<UsuarioSesion>('/api/v1/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  cambiarPassword: (payload: { password_actual: string; password_nueva: string }) =>
    api.request<void>('/api/v1/auth/me/password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};

