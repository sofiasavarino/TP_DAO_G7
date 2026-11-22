import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError } from '../services/api';
import type { RolNombre } from '../types/enums';
import type { UsuarioSesion } from '../types/auth';

const TOKEN_KEY = 'access_token'; // api.ts lee esta misma clave para armar el Bearer
const USER_KEY = 'usuario';

interface AuthContextValue {
  token: string | null;
  usuario: UsuarioSesion | null;
  rol: RolNombre | null;
  /** true mientras se valida el token guardado al abrir la app */
  cargando: boolean;
  /** Inicia sesión. Devuelve el usuario para poder redirigir según su rol. */
  login: (usuario: string, password: string) => Promise<UsuarioSesion>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function leerUsuarioGuardado(): UsuarioSesion | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UsuarioSesion) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(leerUsuarioGuardado);
  const [cargando, setCargando] = useState<boolean>(() => localStorage.getItem(TOKEN_KEY) !== null);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUsuario(null);
  }, []);

  // Al abrir la app con un token guardado, se valida contra /auth/me.
  // Si el token venció (401), se cierra la sesión.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setCargando(false);
      return;
    }
    let cancelado = false;
    api
      .get<UsuarioSesion>('/api/v1/auth/me')
      .then((u) => {
        if (cancelado) return;
        localStorage.setItem(USER_KEY, JSON.stringify(u));
        setUsuario(u);
      })
      .catch((e) => {
        if (!cancelado && e instanceof ApiError && e.status === 401) logout();
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [logout]);

  const login = useCallback(
    async (nombreUsuario: string, password: string) => {
      const { access_token } = await api.post<{ access_token: string }>('/api/v1/auth/login', {
        usuario: nombreUsuario,
        password,
      });
      localStorage.setItem(TOKEN_KEY, access_token); // api.ts lo toma de acá
      try {
        const u = await api.get<UsuarioSesion>('/api/v1/auth/me');
        localStorage.setItem(USER_KEY, JSON.stringify(u));
        setToken(access_token);
        setUsuario(u);
        return u;
      } catch (e) {
        logout();
        throw e;
      }
    },
    [logout],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      usuario,
      rol: usuario ? usuario.rol.nombre : null,
      cargando,
      login,
      logout,
    }),
    [token, usuario, cargando, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}