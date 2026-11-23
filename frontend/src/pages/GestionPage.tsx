import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout, { SECCIONES_GESTION } from '../components/admin/AdminLayout';
import SeccionPendiente from '../components/admin/SeccionPendiente';
import ProtectedRoute from '../components/ProtectedRoute';
import { RolNombre } from '../types/enums';
import { RUTA_GESTION, RUTAS_GESTION } from '../utils/rutas';
import LibrosPage from './gestion/LibrosPage';
import PersonalPage from './gestion/PersonalPage';

/** Rutas hijas de /gestion/* (App.tsx ya restringe a Bibliotecario y Administrador). */
export default function GestionPage() {
  const relativa = (ruta: string) => ruta.slice(RUTA_GESTION.length + 1);

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to={RUTAS_GESTION.catalogo} replace />} />
        <Route path={relativa(RUTAS_GESTION.catalogo)} element={<LibrosPage />} />
        {/* Personal: solo el Administrador (un Bibliotecario que entre por URL vuelve al catálogo) */}
        <Route element={<ProtectedRoute roles={[RolNombre.ADMINISTRADOR]} />}>
          <Route path={relativa(RUTAS_GESTION.personal)} element={<PersonalPage />} />
        </Route>
        {SECCIONES_GESTION.filter(
          (s) => s.to !== RUTAS_GESTION.catalogo && s.to !== RUTAS_GESTION.personal,
        ).map((s) => (
          <Route
            key={s.to}
            path={relativa(s.to)}
            element={<SeccionPendiente titulo={s.label} descripcion={s.descripcion} />}
          />
        ))}
        <Route path="*" element={<Navigate to={RUTAS_GESTION.catalogo} replace />} />
      </Route>
    </Routes>
  );
}
