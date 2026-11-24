import { useCallback, useEffect, useState, type FormEvent } from 'react';
import AdminIcon from '../../components/admin/AdminIcon';
import { ApiError } from '../../services/api';
import { usuariosService } from '../../services/usuariosService';
import type { EmpleadoListado, Sede } from '../../types/usuarios';
import ResetPasswordModal from '../../components/admin/ResetPasswordModal';

type Aviso = { tipo: 'ok' | 'error'; texto: string };

const VACIO = {
  nombre: '',
  apellido: '',
  email: '',
  legajo: '',
  sede_id: '',
  nombre_usuario: '',
  password: '',
};
type Campos = typeof VACIO;
type Errores = Partial<Record<keyof Campos, string>>;

function mensajeDeError(e: unknown, porDefecto: string): string {
  if (e instanceof ApiError) return e.message;
  return `${porDefecto} Verificá que el backend esté levantado.`;
}

/** Genera el próximo legajo correlativo a partir de los existentes (ej. BIB-001, BIB-002...). */
function generarProximoLegajo(personal: EmpleadoListado[]): string {
  let maxNum = 0;
  let prefijo = 'BIB-';
  let digitos = 3;

  for (const p of personal) {
    const match = p.legajo.trim().match(/^([A-Za-z-]*?)(\d+)$/);
    if (match) {
      const n = Number(match[2]);
      if (n >= maxNum) {
        maxNum = n;
        if (match[1]) prefijo = match[1];
        digitos = Math.max(3, match[2].length);
      }
    }
  }

  return `${prefijo}${String(maxNum + 1).padStart(digitos, '0')}`;
}

// function validar(c: Campos): Errores {
//   const e: Errores = {};
//   if (!c.nombre.trim()) e.nombre = 'Obligatorio.';
//   if (!c.apellido.trim()) e.apellido = 'Obligatorio.';
//   if (!/^\S+@\S+\.\S+$/.test(c.email.trim())) e.email = 'Email inválido.';
//   if (!c.legajo.trim()) e.legajo = 'Obligatorio.';
//   if (!c.sede_id) e.sede_id = 'Elegí una sede.';
//   if (!/^[A-Za-z0-9._-]{3,50}$/.test(c.nombre_usuario))
//     e.nombre_usuario = '3 a 50 caracteres: letras, números, punto, guion o guion bajo.';
//   if (c.password.length < 8) e.password = 'Al menos 8 caracteres.';
//   return e;
// }

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

  if (!c.sede_id) e.sede_id = 'Elegí la sede donde vas a retirar los libros.';

  if (!/^[A-Za-z0-9._-]{3,50}$/.test(c.nombre_usuario))
    e.nombre_usuario = 'Entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.';

  if (c.password.length < 8) e.password = 'Al menos 8 caracteres.';

  if (!email) e.email = 'Ingresá tu correo electrónico.';
  else if (!EMAIL_VALIDO.test(email))
    e.email = 'Ingresá un correo electrónico válido (ej. lucia@ejemplo.com).';
  return e;
}

/** Solo Administrador: listado de bibliotecarios y alta de nuevos. */
export default function PersonalPage() {
  const [personal, setPersonal] = useState<EmpleadoListado[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const [formAbierto, setFormAbierto] = useState(false);
  const [campos, setCampos] = useState<Campos>(VACIO);
  const [errores, setErrores] = useState<Errores>({});
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aResetear, setAResetear] = useState<EmpleadoListado | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const [lista, listaSedes] = await Promise.all([
        usuariosService.listarBibliotecarios(),
        usuariosService.listarSedes(),
      ]);
      setPersonal(lista);
      setSedes(listaSedes);
    } catch (e) {
      setErrorCarga(mensajeDeError(e, 'No se pudo cargar el personal.'));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 4500);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const abrirForm = () => {
    setCampos({
      ...VACIO,
      legajo: generarProximoLegajo(personal),
    });
    setErrores({});
    setErrorForm(null);
    setFormAbierto(true);
  };

  const cambiar = (campo: keyof Campos) => (e: { target: { value: string } }) => {
    setCampos((c) => ({ ...c, [campo]: e.target.value }));
    setErrores((er) => ({ ...er, [campo]: undefined }));
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setErrorForm(null);
    const locales = validar(campos);
    setErrores(locales);
    if (Object.keys(locales).length > 0) return;

    setGuardando(true);
    try {
      const nuevo = await usuariosService.registrarBibliotecario({
        nombre: campos.nombre.trim(),
        apellido: campos.apellido.trim(),
        email: campos.email.trim(),
        legajo: campos.legajo.trim(),
        sede_id: Number(campos.sede_id),
        nombre_usuario: campos.nombre_usuario.trim(),
        password: campos.password,
      });
      setPersonal((actual) =>
        [...actual, nuevo].sort((a, b) =>
          `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es'),
        ),
      );
      setFormAbierto(false);
      setAviso({
        tipo: 'ok',
        texto: `Se creó la cuenta de ${nuevo.nombre} ${nuevo.apellido} (usuario "${nuevo.nombre_usuario}").`,
      });
    } catch (err) {
      if (err instanceof ApiError && err.campo && err.campo in VACIO) {
        setErrores({ [err.campo]: err.message });
      } else {
        setErrorForm(mensajeDeError(err, 'No se pudo crear la cuenta.'));
      }
    } finally {
      setGuardando(false);
    }
  };

  const campo = (
    nombre: keyof Campos,
    etiqueta: string,
    placeholder: string,
    tipo = 'text',
    autoComplete = 'off',
  ) => (
    <label>
      {etiqueta}
      <input
        type={tipo}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={campos[nombre]}
        onChange={cambiar(nombre)}
        aria-invalid={errores[nombre] ? true : undefined}
      />
      {errores[nombre] && <span className="campo-error">{errores[nombre]}</span>}
    </label>
  );

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <span className="eyebrow">PERSONAL</span>
          <h1>
            Gestión de <em>bibliotecarios</em>
          </h1>
          <p className="muted">
            {cargando ? 'Cargando personal…' : `${personal.length} bibliotecarios registrados.`}
          </p>
        </div>
        <button className="admin-primary" onClick={abrirForm}>
          <AdminIcon name="plus" size={18} />
          Nuevo bibliotecario
        </button>
      </div>

      {aviso && (
        <div className={`admin-aviso ${aviso.tipo}`} role={aviso.tipo === 'error' ? 'alert' : 'status'}>
          <AdminIcon name={aviso.tipo === 'ok' ? 'check' : 'close'} size={18} />
          <span>{aviso.texto}</span>
          <button onClick={() => setAviso(null)} aria-label="Cerrar aviso">
            <AdminIcon name="close" size={15} />
          </button>
        </div>
      )}

      {errorCarga ? (
        <div className="admin-empty">
          <h3>No pudimos cargar el personal</h3>
          <p>{errorCarga}</p>
          <button className="ghost-btn" onClick={() => void cargar()}>
            Reintentar
          </button>
        </div>
      ) : cargando ? (
        <div className="admin-table-wrap">
          <div className="admin-skeleton" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
        </div>
      ) : personal.length === 0 ? (
        <div className="admin-empty">
          <h3>Todavía no hay bibliotecarios</h3>
          <p>Creá la primera cuenta para que el personal de mostrador pueda ingresar.</p>
          <button className="ghost-btn" onClick={abrirForm}>
            Nuevo bibliotecario
          </button>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Usuario</th>
                <th scope="col">Legajo</th>
                <th scope="col">Sede</th>
                <th scope="col">Estado</th>
                <th scope="col" className="acciones">Acción</th>
              </tr>
            </thead>
            <tbody>
              {personal.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>
                      {p.apellido}, {p.nombre}
                    </strong>
                    <br />
                    <small className="muted">{p.email}</small>
                  </td>
                  <td className="mono">{p.nombre_usuario}</td>
                  <td className="mono">{p.legajo}</td>
                  <td>{p.sede_nombre}</td>
                  <td>
                    <em className={`badge${p.activo ? ' ok' : ''}`}>{p.activo ? 'Activo' : 'De baja'}</em>
                  </td>
                  <td className="acciones">
                    <button
                      type="button"
                      className="inv-accion"
                      onClick={() => setAResetear(p)}
                    >
                      Restablecer clave
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {aResetear && (
              <ResetPasswordModal
                usuarioId={aResetear.usuario_id}
                nombrePersona={`${aResetear.nombre} ${aResetear.apellido}`}
                nombreUsuario={aResetear.nombre_usuario}
                onCerrar={() => setAResetear(null)}
                onGuardada={(texto) => {
                  setAResetear(null);
                  setAviso({ tipo: 'ok', texto });
                }}
              />
            )}

      {formAbierto && (
        <div className="reservation-modal-backdrop" role="presentation">
          <section
            className="reservation-modal libro-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nuevo-biblio-title"
          >
            <button className="modal-close" onClick={() => setFormAbierto(false)} aria-label="Cerrar">
              <AdminIcon name="close" size={18} />
            </button>
            <span className="eyebrow">NUEVO BIBLIOTECARIO</span>
            <h2 id="nuevo-biblio-title">Crear cuenta de personal</h2>
            <p className="muted">
              El bibliotecario va a ingresar con este usuario y contraseña. Pasale la contraseña por un
              canal seguro.
            </p>

            <form className="libro-form" onSubmit={guardar} noValidate>
              <div className="libro-form-campos">
                {campo('nombre', 'Nombre', 'Ej: Lucía')}
                {campo('apellido', 'Apellido', 'Ej: Méndez')}
                {campo('email', 'Email', 'Ej: lucia.mendez@hermes.org', 'email')}

                <div>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Legajo <small className="muted" style={{ fontWeight: 400 }}>(autogenerado)</small>
                  </span>
                  <div
                    className="mono"
                    aria-label="Legajo asignado automáticamente"
                    style={{
                      padding: '12px 14px',
                      border: '1px solid #d4ccbf',
                      borderRadius: 10,
                      background: 'rgba(29, 36, 32, 0.04)',
                      color: 'var(--ink)',
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {campos.legajo}
                  </div>
                  {errores.legajo && <span className="campo-error">{errores.legajo}</span>}
                </div>

                <label className="full">
                  Sede
                  <select
                    value={campos.sede_id}
                    onChange={cambiar('sede_id')}
                    aria-invalid={errores.sede_id ? true : undefined}
                  >
                    <option value="">Elegí una sede…</option>
                    {sedes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                  {errores.sede_id && <span className="campo-error">{errores.sede_id}</span>}
                </label>

                {campo('nombre_usuario', 'Usuario', 'Ej: lucia.mendez', 'text', 'off')}
                {campo('password', 'Contraseña inicial', 'Mínimo 8 caracteres', 'password', 'new-password')}
              </div>

              {errorForm && (
                <div className="login-error" role="alert">
                  {errorForm}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  marginTop: 22,
                }}
              >
                <button
                  type="submit"
                  className="confirm-reservation"
                  disabled={guardando}
                  style={{ width: '100%', marginTop: 0, borderRadius: 0 }}
                >
                  {guardando ? 'CREANDO…' : 'CREAR CUENTA'}
                </button>
                <button
                  type="button"
                  onClick={() => setFormAbierto(false)}
                  disabled={guardando}
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 0,
                    background: '#e5e2dc',
                    color: '#3d433f',
                    border: '1px solid #c9c4ba',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}