import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout, { SECCIONES_GESTION } from '../components/admin/AdminLayout';
import SeccionPendiente from '../components/admin/SeccionPendiente';
import { RUTA_GESTION, RUTAS_GESTION } from '../utils/rutas';
import EjemplaresPage from './gestion/EjemplaresPage';
import LibrosPage from './gestion/LibrosPage';

/** Secciones que ya tienen pantalla propia; el resto muestra un placeholder. */
const IMPLEMENTADAS: string[] = [RUTAS_GESTION.catalogo, RUTAS_GESTION.ejemplares];

/** Rutas hijas de /gestion/* (App.tsx ya restringe a Bibliotecario y Administrador). */
export default function GestionPage() {
  const relativa = (ruta: string) => ruta.slice(RUTA_GESTION.length + 1);

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to={RUTAS_GESTION.catalogo} replace />} />
        <Route path={relativa(RUTAS_GESTION.catalogo)} element={<LibrosPage />} />
        <Route path={relativa(RUTAS_GESTION.ejemplares)} element={<EjemplaresPage />} />
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
