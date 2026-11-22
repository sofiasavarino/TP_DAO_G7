import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { RolNombre } from '../types/enums';
import { RUTA_LOGIN, rutaInicialPorRol } from '../utils/rutas';

interface Props {
  /** Roles que pueden entrar. Si se omite, alcanza con estar logueado. */
  roles?: RolNombre[];
  children?: ReactNode;
}

/**
 * Protege rutas:
 *  - sin sesión            -> redirige a /login
 *  - con sesión, rol no permitido (ej. un Socio en /gestion) -> lo manda a su pantalla inicial
 *
 * Se usa de dos formas:
 *   <Route element={<ProtectedRoute roles={[RolNombre.SOCIO]} />}> ...rutas hijas... </Route>
 *   <ProtectedRoute roles={[...]}><Pagina /></ProtectedRoute>
 */
export default function ProtectedRoute({ roles, children }: Props) {
  const { token, usuario, rol, cargando } = useAuth();
  const location = useLocation();

  // Mientras se valida el token guardado, no decidimos nada (evita un parpadeo al /login)
  if (cargando) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>;
  }

  if (!token || !usuario || !rol) {
    return <Navigate to={RUTA_LOGIN} replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(rol)) {
    const destino = rutaInicialPorRol(rol);
    // Si el destino es la misma ruta donde estamos, redirigir causaría un bucle infinito
    if (destino === location.pathname) {
      return <div style={{ padding: 40, textAlign: 'center' }}>No tenés permiso para ver esta página.</div>;
    }
    return <Navigate to={destino} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}