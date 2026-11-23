import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import GestionPage from './pages/GestionPage';
import LoginPage from './pages/LoginPage';
import PortalSocio from './pages/PortalSocio';
import { RolNombre } from './types/enums';
import { RUTA_GESTION, RUTA_LOGIN, RUTA_PORTAL_SOCIO } from './utils/rutas';

export default function App() {
  return (
    <Routes>
      <Route path={RUTA_LOGIN} element={<LoginPage />} />

      {/* Portal de socios: solo el rol Socio */}
      <Route element={<ProtectedRoute roles={[RolNombre.SOCIO]} />}>
        <Route path={RUTA_PORTAL_SOCIO} element={<PortalSocio />} />
      </Route>

      {/* Panel de gestión: Bibliotecario y Administrador */}
      <Route
        element={<ProtectedRoute roles={[RolNombre.BIBLIOTECARIO, RolNombre.ADMINISTRADOR]} />}
      >
        <Route path={`${RUTA_GESTION}/*`} element={<GestionPage />} />
      </Route>

      {/* Cualquier otra ruta vuelve a "/", y el guardia decide adónde mandarte */}
      <Route path="*" element={<Navigate to={RUTA_PORTAL_SOCIO} replace />} />
    </Routes>
  );
}