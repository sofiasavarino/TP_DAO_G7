import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { RolNombre } from '../../types/enums';
import { RUTA_LOGIN, RUTAS_GESTION } from '../../utils/rutas';
import AdminIcon, { type AdminIconName } from './AdminIcon';

interface Seccion {
  to: string;
  label: string;
  icon: AdminIconName;
  descripcion: string;
  /** Si se indica, solo esos roles ven la sección (por defecto, todo el personal). */
  roles?: RolNombre[];
}

export const SECCIONES_GESTION: Seccion[] = [
  { to: RUTAS_GESTION.catalogo, label: 'Catálogo', icon: 'catalogo', descripcion: 'Libros y alta desde Google Books' },
  { to: RUTAS_GESTION.ejemplares, label: 'Ejemplares', icon: 'ejemplares', descripcion: 'Inventario físico por sede' },
  { to: RUTAS_GESTION.mostrador, label: 'Mostrador', icon: 'mostrador', descripcion: 'Préstamos, devoluciones y retiros' },
  { to: RUTAS_GESTION.remitos, label: 'Remitos', icon: 'remitos', descripcion: 'Traslados entre sedes' },
  { to: RUTAS_GESTION.socios, label: 'Socios', icon: 'socios', descripcion: 'Padrón y sanciones' },
  {
    to: RUTAS_GESTION.personal,
    label: 'Personal',
    icon: 'personal',
    descripcion: 'Alta de bibliotecarios',
    roles: [RolNombre.ADMINISTRADOR],
  },
];

/** Secciones que puede ver un rol. */
export function seccionesPara(rol: RolNombre | null): Seccion[] {
  return SECCIONES_GESTION.filter((s) => !s.roles || (rol !== null && s.roles.includes(rol)));
}

function iniciales(nombre: string): string {
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || '?'
  );
}

/**
 * F5.1 – Estructura del panel de gestión (Bibliotecario / Administrador):
 * barra lateral con las secciones y cabecera con el usuario logueado.
 * Cada sección se renderiza en el <Outlet />.
 */
export default function AdminLayout() {
  const { usuario, rol, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);

  // En mobile la barra lateral es un panel: se cierra al cambiar de sección
  useEffect(() => setMenuAbierto(false), [location.pathname]);

  const nombreCompleto =
    [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ') || usuario?.nombre_usuario || '';
  const seccionActual = SECCIONES_GESTION.find((s) => location.pathname.startsWith(s.to));

  const cerrarSesion = () => {
    logout();
    navigate(RUTA_LOGIN, { replace: true });
  };

  return (
    <div className={`admin-shell${menuAbierto ? ' menu-abierto' : ''}`}>
      <aside className="admin-sidebar" aria-label="Secciones del panel">
        <div className="admin-brand">
          <span>Herm</span>
          <i>es</i>
          <b>.</b>
          <small>Gestión</small>
        </div>

        <nav aria-label="Navegación del panel">
          {seccionesPara(rol).map((s) => (
            <NavLink key={s.to} to={s.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <AdminIcon name={s.icon} size={19} />
              <span>{s.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-foot">
          <span>Sede</span>
          <strong>{usuario?.sede.nombre ?? '—'}</strong>
        </div>
      </aside>

      {menuAbierto && (
        <button className="admin-scrim" aria-label="Cerrar menú" onClick={() => setMenuAbierto(false)} />
      )}

      <div className="admin-body">
        <header className="admin-header">
          <button
            className="admin-menu-toggle"
            onClick={() => setMenuAbierto(true)}
            aria-label="Abrir menú"
          >
            <AdminIcon name="menu" />
          </button>

          <div className="admin-header-title">
            <span className="eyebrow">PANEL DE GESTIÓN</span>
            <strong>{seccionActual?.label ?? 'Inicio'}</strong>
          </div>

          <div className="admin-user">
            <span className="admin-avatar" aria-hidden="true">
              {iniciales(nombreCompleto)}
            </span>
            <div>
              <strong>{nombreCompleto}</strong>
              <small>
                {rol} · {usuario?.sede.nombre}
              </small>
            </div>
            <button className="admin-logout" onClick={cerrarSesion}>
              <AdminIcon name="logout" size={17} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </header>

        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
