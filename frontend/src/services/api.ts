const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Clase de error personalizada para capturar los mensajes de negocio de FastAPI
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...customConfig } = options;

  // 1. Armar URL con query params si existen (ej: ?titulo=rayuela&sede_id=1)
  const url = new URL(`${API_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }

  // 2. Recuperar token JWT guardado en localStorage (si hay sesión iniciada)
  const token = localStorage.getItem('access_token');

  const config: RequestInit = {
    ...customConfig,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  };

  const response = await fetch(url.toString(), config);

  // 3. Manejar respuestas vacías (ej: 204 No Content al cancelar/borrar)
  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json().catch(() => null);

  // 4. Si FastAPI devuelve error (400, 401, 403, 404, 422), extraer el mensaje de "detail"
  if (!response.ok) {
    const errorMessage =
      typeof data?.detail === 'string'
        ? data.detail
        : Array.isArray(data?.detail)
          ? data.detail.map((err: { msg?: string }) => err.msg).join(', ')
          : `Error HTTP ${response.status}`;

    throw new ApiError(response.status, errorMessage);
  }

  return data as T;
}

// Métodos listos para consumir desde los servicios por entidad (F1.5)
export const api = {
  get: <T>(endpoint: string, params?: RequestOptions['params']) =>
    request<T>(endpoint, { method: 'GET', params }),

  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),
};