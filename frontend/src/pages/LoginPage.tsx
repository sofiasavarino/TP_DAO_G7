// // import { useState, type FormEvent } from 'react';
// // import { Link, Navigate, useNavigate } from 'react-router-dom';
// // import { useAuth } from '../context/AuthContext';
// // import { ApiError } from '../services/api';
// // import { RUTA_REGISTRO, rutaInicialPorRol } from '../utils/rutas';

// // export default function LoginPage() {
// //   const { usuario, rol, cargando, login } = useAuth();
// //   const navigate = useNavigate();
// //   const [nombreUsuario, setNombreUsuario] = useState('');
// //   const [password, setPassword] = useState('');
// //   const [error, setError] = useState<string | null>(null);
// //   const [enviando, setEnviando] = useState(false);

// //   // Si ya hay sesión iniciada, no tiene sentido mostrar el login
// //   if (!cargando && usuario && rol) {
// //     return <Navigate to={rutaInicialPorRol(rol)} replace />;
// //   }

// //   const onSubmit = async (e: FormEvent) => {
// //     e.preventDefault();
// //     setError(null);
// //     setEnviando(true);
// //     try {
// //       const u = await login(nombreUsuario.trim(), password);
// //       navigate(rutaInicialPorRol(u.rol.nombre), { replace: true });
// //     } catch (err) {
// //       if (err instanceof ApiError) {
// //         setError(err.status === 401 ? 'Usuario o contraseña incorrectos' : err.message);
// //       } else {
// //         setError('No se pudo conectar con el servidor. Verificá que el backend esté levantado.');
// //       }
// //     } finally {
// //       setEnviando(false);
// //     }
// //   };

// //   return (
// //     <main className="login-page">
// //       <section className="login-card">
// //         <div className="brand login-brand">
// //           <span>Herm</span>
// //           <i>es</i>
// //           <b>.</b>
// //         </div>
// //         <h1>Iniciá sesión</h1>
// //         <p className="login-sub">Ingresá con tu usuario de la biblioteca.</p>

// //         <form className="login-form" onSubmit={onSubmit}>
// //           {error && (
// //             <div className="login-error" role="alert">
// //               {error}
// //             </div>
// //           )}
// //           <label>
// //             Usuario
// //             <input
// //               required
// //               autoFocus
// //               autoComplete="username"
// //               placeholder="Ej: lucia.mendez"
// //               value={nombreUsuario}
// //               onChange={(e) => setNombreUsuario(e.target.value)}
// //             />
// //           </label>
// //           <label>
// //             Contraseña
// //             <input
// //               required
// //               type="password"
// //               autoComplete="current-password"
// //               value={password}
// //               onChange={(e) => setPassword(e.target.value)}
// //             />
// //           </label>
// //           <button className="confirm-reservation" type="submit" disabled={enviando}>
// //             {enviando ? 'Ingresando...' : 'Ingresar'}
// //           </button>
// //         </form>

// //         <p className="login-alt">
// //           ¿No tenés cuenta? <Link to={RUTA_REGISTRO}>Registrate como socio</Link>
// //         </p>
// //       </section>
// //     </main>
// //   );
// // }
// import { useState, type FormEvent } from 'react';
// import { Link, Navigate, useNavigate } from 'react-router-dom';
// import { useAuth } from '../context/AuthContext';
// import { ApiError } from '../services/api';
// import { RUTA_REGISTRO, rutaInicialPorRol } from '../utils/rutas';

// export default function LoginPage() {
//   const { usuario, rol, cargando, login } = useAuth();
//   const navigate = useNavigate();
//   const [nombreUsuario, setNombreUsuario] = useState('');
//   const [password, setPassword] = useState('');
//   const [error, setError] = useState<string | null>(null);
//   const [enviando, setEnviando] = useState(false);
//   const [olvideClave, setOlvideClave] = useState(false);

//   if (!cargando && usuario && rol) {
//     return <Navigate to={rutaInicialPorRol(rol)} replace />;
//   }

//   const onSubmit = async (e: FormEvent) => {
//     e.preventDefault();
//     setError(null);
//     if (!nombreUsuario.trim()) {
//       setError('Ingresá tu nombre de usuario.');
//       return;
//     }
//     setEnviando(true);
//     try {
//       const u = await login(nombreUsuario.trim(), password);
//       navigate(rutaInicialPorRol(u.rol.nombre), { replace: true });
//     } catch (err) {
//       if (err instanceof ApiError) {
//         setError(err.status === 401 ? 'Usuario o contraseña incorrectos.' : err.message);
//       } else {
//         setError('No se pudo conectar con el servidor. Verificá que el backend esté levantado.');
//       }
//     } finally {
//       setEnviando(false);
//     }
//   };

//   return (
//     <main className="login-page">
//       <section className="login-card">
//         <div className="brand login-brand">
//           <span>Herm</span>
//           <i>es</i>
//           <b>.</b>
//         </div>
//         <h1>Iniciá sesión</h1>
//         <p className="login-sub">Ingresá con tu usuario de la biblioteca.</p>

//         <form className="login-form" onSubmit={onSubmit}>
//           {error && (
//             <div className="login-error" role="alert">
//               {error}
//             </div>
//           )}
//           <label>
//             Usuario
//             <input
//               required
//               autoFocus
//               autoComplete="username"
//               placeholder="Ej: lucia.mendez"
//               value={nombreUsuario}
//               onChange={(e) => setNombreUsuario(e.target.value)}
//             />
//           </label>
//           <label>
//             Contraseña
//             <input
//               required
//               type="password"
//               autoComplete="current-password"
//               placeholder="Ingresá tu contraseña"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//             />
//           </label>

//           <button
//             type="button"
//             className="link-inline"
//             onClick={() => setOlvideClave((v) => !v)}
//           >
//             ¿Olvidaste tu contraseña?
//           </button>

//           {olvideClave && (
//             <p className="info-box" role="note">
//               Para blanquear tu contraseña, acercate al mostrador de cualquiera de nuestras sedes con tu DNI o escribinos desde tu correo registrado.
//             </p>
//           )}

//           <button className="confirm-reservation" type="submit" disabled={enviando}>
//             {enviando ? 'Ingresando...' : 'Ingresar'}
//           </button>
//         </form>

//         <p className="login-alt">
//           ¿No tenés cuenta? <Link to={RUTA_REGISTRO}>Registrate como socio</Link>
//         </p>
//       </section>
//     </main>
//   );
// }
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import { RUTA_REGISTRO, rutaInicialPorRol } from '../utils/rutas';

export default function LoginPage() {
  const { usuario, rol, cargando, login } = useAuth();
  const navigate = useNavigate();
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [olvideClave, setOlvideClave] = useState(false);

  if (!cargando && usuario && rol) {
    return <Navigate to={rutaInicialPorRol(rol)} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!nombreUsuario.trim()) {
      setError('Ingresá tu nombre de usuario.');
      return;
    }
    setEnviando(true);
    try {
      const u = await login(nombreUsuario.trim(), password);
      navigate(rutaInicialPorRol(u.rol.nombre), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? 'Usuario o contraseña incorrectos.' : err.message);
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
              placeholder="Ej: lucia.mendez"
              value={nombreUsuario}
              onChange={(e) => setNombreUsuario(e.target.value)}
            />
          </label>
          <label>
            Contraseña
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                required
                type={mostrarPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Ingresá tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', paddingRight: 42 }}
              />
              <button
                type="button"
                onClick={() => setMostrarPassword((v) => !v)}
                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                aria-pressed={mostrarPassword}
                style={{
                  position: 'absolute',
                  right: 10,
                  background: 'transparent',
                  border: 0,
                  padding: 4,
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                {mostrarPassword ? (
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <path d="m1 1 22 22" />
                  </svg>
                ) : (
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          <button
            type="button"
            className="link-inline"
            onClick={() => setOlvideClave((v) => !v)}
          >
            ¿Olvidaste tu contraseña?
          </button>

          {olvideClave && (
            <p className="info-box" role="note">
              Para blanquear tu contraseña, acercate al mostrador de cualquiera de nuestras sedes con tu DNI o escribinos desde tu correo registrado.
            </p>
          )}

          <button className="confirm-reservation" type="submit" disabled={enviando}>
            {enviando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="login-alt">
          ¿No tenés cuenta? <Link to={RUTA_REGISTRO}>Registrate como socio</Link>
        </p>
      </section>
    </main>
  );
}