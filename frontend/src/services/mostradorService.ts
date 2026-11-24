import { api, ApiError } from './api';
import type {
  Prestamo,
  PrestamoListado,
  PrestamoPayload,
  ReservaListaRetiro,
  SancionVigente,
  SocioBusqueda,
} from '../types/mostrador';
import type { PrestamoTipo } from '../types/enums';

const PRESTAMOS = '/api/v1/prestamos';
const RESERVAS = '/api/v1/reservas';

/**
 * ENDPOINTS QUE TODAVÍA NO EXISTEN EN EL BACKEND.
 * La pantalla ya los usa: cuando alguien los agregue con esta ruta y este formato,
 * el mostrador funciona sin tocar nada más. Si se crean con otra ruta, cambiarla acá.
 *
 * 1) GET /api/v1/reservas/listas-para-retiro?sede_id={id}
 *    Reservas en estado LISTA_PARA_RETIRO cuya sede de retiro es `sede_id`.
 *    Devuelve ReservaDTO[] (opcionalmente con socio_nombre, socio_dni, libro_nombre y
 *    ejemplar_codigo: ver ReservaListaRetiro en types/mostrador.ts).
 *
 * 2) GET /api/v1/socios?q={texto}
 *    Busca socios por nombre, apellido o DNI (SocioRepository.buscar ya existe).
 *    Devuelve [{ id, nombre, apellido, dni, email?, estado? }].
 *    Mientras no exista, el formulario permite cargar el N° de socio a mano.
 */
export const ENDPOINTS_PENDIENTES = {
  reservasListas: `${RESERVAS}/listas-para-retiro`,
  socios: '/api/v1/socios',
} as const;

/** Arma "?a=1&b=2" para los endpoints que reciben datos por query (PUT/POST con Query(...)). */
function query(params: Record<string, string | number | boolean>): string {
  return `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}`;
}

/**
 * true si el error es porque la ruta no existe en el backend (FastAPI responde 404 "Not Found"
 * o 405 cuando la ruta no está registrada), no por una regla de negocio.
 */
export function esEndpointFaltante(e: unknown): boolean {
  return e instanceof ApiError && ((e.status === 404 && e.message === 'Not Found') || e.status === 405);
}

export const mostradorService = {
  // ---------------------------------------------------------------- F7.1 reservas

  /** Reservas LISTA_PARA_RETIRO de la sede. ⚠ Endpoint pendiente (ver arriba). */
  reservasListas: (sedeId: number) =>
    api.get<ReservaListaRetiro[]>(ENDPOINTS_PENDIENTES.reservasListas, { sede_id: sedeId }),

  /** El socio retira: la reserva pasa a CUMPLIDA y nace el préstamo (endpoint existente). */
  entregarReserva: (reservaId: number, sedeId: number, usuarioId: number, tipo: PrestamoTipo) =>
    api.post<Prestamo>(
      `${RESERVAS}/${reservaId}/retira${query({ sede_id: sedeId, responsable_retiro_id: usuarioId, tipo })}`,
    ),

  // ---------------------------------------------------------- F7.2 préstamo directo

  /** Busca socios por nombre, apellido o DNI. ⚠ Endpoint pendiente (ver arriba). */
  buscarSocios: (q: string) => api.get<SocioBusqueda[]>(ENDPOINTS_PENDIENTES.socios, { q }),

  /** Préstamos del socio (para avisar si llegó al límite antes de prestar). */
  prestamosDeSocio: (socioId: number) => api.get<PrestamoListado[]>(`${PRESTAMOS}/mios`, { socio_id: socioId }),

  /** Sanciones vigentes hoy del socio (para avisar si está bloqueado antes de prestar). */
  sancionesVigentes: (socioId: number) => api.get<SancionVigente[]>(`/api/v1/sanciones/${socioId}`),

  /** Alta de préstamo. Errores de negocio: 403 SocioSancionado, 409 LimitePrestamosExcedido. */
  crearPrestamo: (payload: PrestamoPayload) => api.post<Prestamo>(PRESTAMOS, payload),

  // ------------------------------------------------- F7.3 préstamos y devoluciones

  /** Todos los préstamos (la pantalla se queda con ACTIVO y VENCIDO). */
  listarPrestamos: () => api.get<PrestamoListado[]>(PRESTAMOS),

  activarSocio: (socioId: number) =>
    api.put<SocioBusqueda>(`${ENDPOINTS_PENDIENTES.socios}/${socioId}/activar`),

  /** Devolución en la sede del mostrador. Con `conDanios` el ejemplar va a reparación. */
  registrarDevolucion: (prestamoId: number, sedeId: number, usuarioId: number, conDanios: boolean) =>
    api.put<Prestamo>(
      `${PRESTAMOS}/${prestamoId}/devolucion${query({
        sede_id: sedeId,
        responsable_devolucion_id: usuarioId,
        con_danios: conDanios,
      })}`,
    ),
};
