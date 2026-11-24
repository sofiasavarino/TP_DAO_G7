import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import { usuariosService } from '../services/usuariosService';
import type { Sede } from '../types/usuarios';
import { RUTA_LOGIN, RUTA_PORTAL_SOCIO, rutaInicialPorRol } from '../utils/rutas';

const VACIO = {
  nombre: '',
  apellido: '',
  dni: '',
  email: '',
  telefono: '',
  sede_id: '',
  nombre_usuario: '',
  password: '',
  confirmar: '',
};
type Campos = typeof VACIO;
type Errores = Partial<Record<keyof Campos, string>>;

const SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validar(c: Campos): Errores {
  const e: Errores = {};
  const nombre = c.nombre.trim();
  const apellido = c.apellido.trim();
  const email = c.email.trim();
  if (!nombre) e.nombre = 'Ingresá tu nombre.';
  else if (!SOLO_LETRAS.test(nombre)) e.nombre = 'El nombre solo puede contener letras.';

  if (!apellido) e.apellido = 'Ingresá tu apellido.';
  else if (!SOLO_LETRAS.test(apellido)) e.apellido = 'El apellido solo puede contener letras.';

  if (!/^\d{7,10}$/.test(c.dni)) e.dni = 'Solo números, sin puntos (7 a 10 dígitos).';

  if (!c.sede_id) e.sede_id = 'Elegí la sede donde vas a retirar los libros.';

  if (!/^[A-Za-z0-9._-]{3,50}$/.test(c.nombre_usuario))
    e.nombre_usuario = 'Entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.';

  if (c.password.length < 8) e.password = 'Al menos 8 caracteres.';

  if (c.confirmar !== c.password) e.confirmar = 'Las contraseñas no coinciden.';

  if (c.telefono && !/^\d{7,15}$/.test(c.telefono)) e.telefono = 'Ingresá solo números (entre 7 y 15 dígitos, sin +54).';

  if (!email) e.email = 'Ingresá tu correo electrónico.';
  else if (!EMAIL_VALIDO.test(email))
    e.email = 'Ingresá un correo electrónico válido (ej. lucia@ejemplo.com).';
  return e;
}

/** Autorregistro de socios: crea la cuenta y entra directo al portal. */
export default function RegistroPage() {
  const { usuario, rol, cargando, login } = useAuth();
  const navigate = useNavigate();
  const [campos, setCampos] = useState<Campos>(VACIO);
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    usuariosService
      .listarSedes()
      .then(setSedes)
      .catch(() => setErrorGeneral('No se pudieron cargar las sedes. Verificá que el backend esté levantado.'));
  }, []);

  if (!cargando && usuario && rol) {
    return <Navigate to={rutaInicialPorRol(rol)} replace />;
  }

  const cambiar = (campo: keyof Campos) => (e: { target: { value: string } }) => {
    const val = campo === 'telefono' || campo === 'dni' ? e.target.value.replace(/\D/g, '') : e.target.value;
    setCampos((c) => ({ ...c, [campo]: e.target.value }));
    setErrores((er) => ({ ...er, [campo]: undefined }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorGeneral(null);
    const locales = validar(campos);
    setErrores(locales);
    if (Object.keys(locales).length > 0) return;

    setEnviando(true);
    try {
      await usuariosService.registrarSocio({
        nombre: campos.nombre.trim(),
        apellido: campos.apellido.trim(),
        dni: campos.dni.trim(),
        email: campos.email.trim(),
        telefono: campos.telefono.trim() || null,
        sede_id: Number(campos.sede_id),
        nombre_usuario: campos.nombre_usuario.trim(),
        password: campos.password,
      });
      // Cuenta creada: iniciamos sesión con las mismas credenciales.
      await login(campos.nombre_usuario.trim(), campos.password);
      navigate(RUTA_PORTAL_SOCIO, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.campo && err.campo in VACIO) {
          setErrores({ [err.campo]: err.message });
        } else {
          setErrorGeneral(err.message);
        }
      } else {
        setErrorGeneral('No se pudo conectar con el servidor. Verificá que el backend esté levantado.');
      }
    } finally {
      setEnviando(false);
    }
  };

  const campo = (
    nombre: keyof Campos,
    etiqueta: string,
    props: InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label className={props.className}>
      {etiqueta}
      <input
        {...props}
        className={undefined}
        value={campos[nombre]}
        onChange={cambiar(nombre)}
        aria-invalid={errores[nombre] ? true : undefined}
      />
      {errores[nombre] && <span className="campo-error">{errores[nombre]}</span>}
    </label>
  );

  return (
    <main className="login-page">
      <section className="login-card registro-card">
        <div className="brand login-brand">
          <span>Herm</span>
          <i>es</i>
          <b>.</b>
        </div>
        <h1>Creá tu cuenta</h1>
        <p className="login-sub">Registrate como socio para reservar y pedir libros.</p>

        <form className="login-form registro-form" onSubmit={onSubmit} noValidate>
          {errorGeneral && (
            <div className="login-error full" role="alert">
              {errorGeneral}
            </div>
          )}

          {campo('nombre', 'Nombre', { required: true, autoFocus: true, autoComplete: 'given-name', maxLength: 100, placeholder: 'Ej: Lucía'})}
          {campo('apellido', 'Apellido', { required: true, autoComplete: 'family-name',placeholder: 'Ej: Méndez', maxLength: 100 })}
          {campo('dni', 'DNI (sin puntos)', { required: true, inputMode: 'numeric', placeholder: 'Ej: 40123456'})}
          {campo('telefono', 'Teléfono (opcional, solo números sin +54)', { inputMode: 'numeric', type: 'tel', autoComplete: 'tel', maxLength: 30, placeholder: 'Ej: 3515551234'})}
          {campo('email', 'Email', { required: true, type: 'email', autoComplete: 'email', className: 'full', placeholder: "Ej: lucia@example.com" })}

          <label className="full">
            Sede
            <select
              required
              value={campos.sede_id}
              onChange={cambiar('sede_id')}
              aria-invalid={errores.sede_id ? true : undefined}
            >
              <option value="">Elegí una sede…</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre} — {s.direccion}
                </option>
              ))}
            </select>
            {errores.sede_id && <span className="campo-error">{errores.sede_id}</span>}
          </label>

          {campo('nombre_usuario', 'Usuario', { required: true, autoComplete: 'username', className: 'full' })}
          {campo('password', 'Contraseña', { required: true, type: 'password', autoComplete: 'new-password' })}
          {campo('confirmar', 'Repetir contraseña', { required: true, type: 'password', autoComplete: 'new-password' })}

          <button className="confirm-reservation full" type="submit" disabled={enviando}>
            {enviando ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="login-alt">
          ¿Ya tenés cuenta? <Link to={RUTA_LOGIN}>Iniciá sesión</Link>
        </p>
      </section>
    </main>
  );
}
