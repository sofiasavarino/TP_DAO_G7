import { useAuth } from '../context/AuthContext';

export default function GestionPage() {
  const { usuario, rol, logout } = useAuth();

  return (
    <div className="gestion-page">
      <span className="eyebrow">PANEL DE GESTIÓN</span>
      <h1>Hola, {usuario?.nombre ?? usuario?.nombre_usuario}</h1>
      <p>
        Rol: <strong>{rol}</strong> · Sede: <strong>{usuario?.sede.nombre}</strong>
      </p>
      <p className="muted">Acá va a ir el panel de gestión (préstamos, remitos, stock).</p>
      <button className="confirm-reservation" onClick={logout}>
        Cerrar sesión
      </button>
    </div>
  );
}