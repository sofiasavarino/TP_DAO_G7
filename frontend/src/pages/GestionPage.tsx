import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout, { SECCIONES_GESTION } from '../components/admin/AdminLayout';
import SeccionPendiente from '../components/admin/SeccionPendiente';
import ProtectedRoute from '../components/ProtectedRoute';
import { RolNombre } from '../types/enums';
import { RUTA_GESTION, RUTAS_GESTION } from '../utils/rutas';
import EjemplaresPage from './gestion/EjemplaresPage';
import LibrosPage from './gestion/LibrosPage';
import MostradorPage from './gestion/MostradorPage';
import RemitosPage from './gestion/RemitosPage';
import SociosPage from './gestion/SociosPage';
import PersonalPage from './gestion/PersonalPage';
import ReportesPage from './gestion/ReportesPage';

/** Secciones que ya tienen pantalla propia; el resto muestra un placeholder. */
const IMPLEMENTADAS: string[] = [
  RUTAS_GESTION.catalogo,
  RUTAS_GESTION.ejemplares,
  RUTAS_GESTION.mostrador,
  RUTAS_GESTION.remitos,
  RUTAS_GESTION.socios,
  RUTAS_GESTION.personal,
  RUTAS_GESTION.reportes,
];

/** Rutas hijas de /gestion/* (App.tsx ya restringe a Bibliotecario y Administrador). */
export default function GestionPage() {
  const relativa = (ruta: string) => ruta.slice(RUTA_GESTION.length + 1);

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to={RUTAS_GESTION.catalogo} replace />} />
        <Route path={relativa(RUTAS_GESTION.catalogo)} element={<LibrosPage />} />
        <Route path={relativa(RUTAS_GESTION.ejemplares)} element={<EjemplaresPage />} />
        <Route path={relativa(RUTAS_GESTION.mostrador)} element={<MostradorPage />} />
        <Route path={relativa(RUTAS_GESTION.remitos)} element={<RemitosPage />} />
        <Route path={relativa(RUTAS_GESTION.socios)} element={<SociosPage />} />
        {/* Personal: solo el Administrador (un Bibliotecario que entre por URL vuelve al catálogo) */}
        <Route element={<ProtectedRoute roles={[RolNombre.ADMINISTRADOR]} />}>
          <Route path={relativa(RUTAS_GESTION.personal)} element={<PersonalPage />} />
          <Route path={relativa(RUTAS_GESTION.reportes)} element={<ReportesPage />} />
        </Route>
        {SECCIONES_GESTION.filter((s) => !IMPLEMENTADAS.includes(s.to)).map((s) => (
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