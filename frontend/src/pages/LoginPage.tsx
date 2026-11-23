import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import { rutaInicialPorRol } from '../utils/rutas';

export default function LoginPage() {
  const { usuario, rol, cargando, login } = useAuth();
  const navigate = useNavigate();
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Si ya hay sesión iniciada, no tiene sentido mostrar el login
  if (!cargando && usuario && rol) {
    return <Navigate to={rutaInicialPorRol(rol)} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const u = await login(nombreUsuario.trim(), password);
      navigate(rutaInicialPorRol(u.rol.nombre), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? 'Usuario o contraseña incorrectos' : err.message);
      } else {
        setError('No se pudo conectar con el servidor. Verificá que el backend esté levantado.');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand login-brand">
          <span>Herm</span>
          <i>es</i>
          <b>.</b>
        </div>
        <h1>Iniciá sesión</h1>
        <p className="login-sub">Ingresá con tu usuario de la biblioteca.</p>

        <form className="login-form" onSubmit={onSubmit}>
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
          <label>
            Usuario
            <input
              required
              autoFocus
              autoComplete="username"
              value={nombreUsuario}
              onChange={(e) => setNombreUsuario(e.target.value)}
            />
          </label>
          <label>
            Contraseña
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="confirm-reservation" type="submit" disabled={enviando}>
            {enviando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  );
}