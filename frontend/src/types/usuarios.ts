// Tipos del alta de cuentas (espejo de backend/app/dtos/registro_dto.py y sede_dto.py).

/** GET /api/v1/sedes */
export interface Sede {
  id: number;
  nombre: string;
  direccion: string;
  telefono: string | null;
  email: string | null;
  horario_atencion: string | null;
  activo: boolean;
}

interface CuentaPayload {
  nombre_usuario: string;
  password: string;
  nombre: string;
  apellido: string;
  email: string;
  sede_id: number;
}

/** POST /api/v1/auth/registro */
export interface RegistroSocioPayload extends CuentaPayload {
  dni: string;
  telefono: string | null;
}

/** POST /api/v1/usuarios/bibliotecarios */
export interface RegistroBibliotecarioPayload extends CuentaPayload {
  legajo: string;
}

/** GET/POST /api/v1/usuarios/bibliotecarios */
export interface EmpleadoListado {
  id: number;
  usuario_id: number;
  nombre_usuario: string;
  nombre: string;
  apellido: string;
  email: string;
  legajo: string;
  sede_id: number;
  sede_nombre: string;
  activo: boolean;
}
