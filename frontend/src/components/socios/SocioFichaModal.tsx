// import { useEffect, useMemo, useState, type FormEvent } from 'react';
// import { sociosService } from '../../services/sociosService';
// import { PrestamoEstado, SancionTipo, SocioEstado } from '../../types/enums';
// import type { PrestamoListado } from '../../types/mostrador';
// import { ETIQUETA_ESTADO_SOCIO, ETIQUETA_SANCION, type Sancion, type Socio } from '../../types/socios';
// import { diasHasta, formatearFecha, textoVencimiento } from '../../utils/fechas';
// import AdminIcon from '../admin/AdminIcon';
// import { mensajeDeError } from '../mostrador/avisos';

// /** Socio con sus préstamos y sanciones vigentes ya cruzados (lo arma SociosPage). */
// export interface SocioVista extends Socio {
//   prestamos: PrestamoListado[];
//   abiertos: number;
//   vencidos: PrestamoListado[];
//   sanciones: Sancion[];
// }

// /** Préstamo atrasado: VENCIDO según el backend, o ACTIVO con la fecha ya pasada. */
// export function estaAtrasado(p: PrestamoListado): boolean {
//   return p.estado === PrestamoEstado.VENCIDO || (p.estado === PrestamoEstado.ACTIVO && diasHasta(p.fecha_vencimiento) < 0);
// }

// interface Props {
//   socio: SocioVista;
//   usuarioId: number;
//   onCerrar: () => void;
//   onCambio: (aviso: string) => void;
// }

// const pesos = (n: number) => `$${n.toLocaleString('es-AR')}`;

// /**
//  * F8.4 – Ficha del socio: préstamos vencidos, sanciones vigentes (con "Levantar") y el
//  * formulario para aplicar una MULTA (con monto) o una SUSPENSION (con días) sobre un préstamo.
//  */
// export default function SocioFichaModal({ socio, usuarioId, onCerrar, onCambio }: Props) {
//   const [formAbierto, setFormAbierto] = useState(false);
//   const [prestamoId, setPrestamoId] = useState<number | ''>('');
//   const [aLevantar, setALevantar] = useState<number | null>(null);
//   const [levantando, setLevantando] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onCerrar();
//     window.addEventListener('keydown', onKey);
//     return () => window.removeEventListener('keydown', onKey);
//   }, [onCerrar]);

//   const numeroDe = (id: number) => socio.prestamos.find((p) => p.id === id)?.numero ?? `#${id}`;
//   const sancionados = new Set(socio.sanciones.map((s) => s.prestamo_id));

//   const abrirForm = (id: number | '') => {
//     setPrestamoId(id);
//     setFormAbierto(true);
//     setError(null);
//   };

//   const levantar = async (s: Sancion) => {
//     setLevantando(true);
//     setError(null);
//     try {
//       await sociosService.levantar(s.id, usuarioId);
//       setALevantar(null);
//       onCambio(`Se levantó la ${ETIQUETA_SANCION[s.tipo].toLowerCase()} de ${socio.nombre} ${socio.apellido}.`);
//     } catch (e) {
//       setError(mensajeDeError(e, 'No se pudo levantar la sanción.'));
//     } finally {
//       setLevantando(false);
//     }
//   };

//   return (
//     <div className="reservation-modal-backdrop" role="presentation">
//       <section className="reservation-modal soc-ficha" role="dialog" aria-modal="true" aria-labelledby="ficha-title">
//         <button className="modal-close" onClick={onCerrar} aria-label="Cerrar">
//           <AdminIcon name="close" size={18} />
//         </button>
//         <span className="eyebrow">FICHA DE SOCIO</span>
//         <h2 id="ficha-title" className="soc-ficha-titulo">
//           {socio.apellido}, {socio.nombre}
//           <span className={`estado-pill est-soc-${socio.estado.toLowerCase()}`}>
//             <i aria-hidden="true" />
//             {ETIQUETA_ESTADO_SOCIO[socio.estado]}
//           </span>
//         </h2>
//         <p className="muted soc-ficha-sub">
//           N° {socio.id} · DNI {socio.dni}
//           {socio.telefono ? ` · Tel. ${socio.telefono}` : ''}
//         </p>

//         <div className="soc-datos">
//           <div>
//             <span>Préstamos abiertos</span>
//             <strong>{socio.abiertos}</strong>
//           </div>
//           <div>
//             <span>Vencidos</span>
//             <strong className={socio.vencidos.length ? 'mal' : ''}>{socio.vencidos.length}</strong>
//           </div>
//           <div>
//             <span>Sanciones vigentes</span>
//             <strong className={socio.sanciones.length ? 'mal' : ''}>{socio.sanciones.length}</strong>
//           </div>
//         </div>

//         {error && (
//           <div className="login-error" role="alert">
//             {error}
//           </div>
//         )}

//         {/* --- Sanciones vigentes --- */}
//         <h3 className="soc-seccion">Sanciones vigentes</h3>
//         {socio.sanciones.length === 0 ? (
//           <p className="soc-vacio">No tiene sanciones vigentes.</p>
//         ) : (
//           <ul className="soc-lista">
//             {socio.sanciones.map((s) => (
//               <li key={s.id}>
//                 <div>
//                   <span className={`soc-sancion ${s.tipo.toLowerCase()}`}>{ETIQUETA_SANCION[s.tipo]}</span>
//                   <strong>
//                     {s.tipo === SancionTipo.MULTA && s.monto != null && pesos(s.monto)}
//                     {s.tipo === SancionTipo.SUSPENSION && s.dias_suspension != null && `${s.dias_suspension} días`}
//                     {s.tipo === 'REPOSICION' && 'Hasta reponer el libro'}
//                   </strong>
//                   <small>
//                     {s.motivo} · Préstamo {numeroDe(s.prestamo_id)} · desde {formatearFecha(s.fecha_inicio)}
//                     {s.fecha_fin ? ` hasta ${formatearFecha(s.fecha_fin)}` : ''}
//                   </small>
//                 </div>
//                 {s.tipo === 'REPOSICION' ? (
//                   <small className="muted soc-nota">Se levanta al reponer el libro</small>
//                 ) : aLevantar === s.id ? (
//                   <span className="inv-acciones">
//                     <button className="inv-accion" onClick={() => setALevantar(null)} disabled={levantando}>
//                       No
//                     </button>
//                     <button className="inv-accion ok" onClick={() => void levantar(s)} disabled={levantando}>
//                       {levantando ? 'Levantando…' : 'Sí, levantar'}
//                     </button>
//                   </span>
//                 ) : (
//                   <button className="inv-accion" onClick={() => setALevantar(s.id)}>
//                     Levantar
//                   </button>
//                 )}
//               </li>
//             ))}
//           </ul>
//         )}

//         {/* --- Préstamos vencidos --- */}
//         <h3 className="soc-seccion">Préstamos vencidos</h3>
//         {socio.vencidos.length === 0 ? (
//           <p className="soc-vacio">No tiene préstamos vencidos.</p>
//         ) : (
//           <ul className="soc-lista">
//             {socio.vencidos.map((p) => (
//               <li key={p.id} className="atrasado">
//                 <div>
//                   <strong className="mono">{p.numero}</strong>
//                   <small>
//                     Ejemplar <span className="mono">{p.ejemplar_codigo}</span> · venció el{' '}
//                     {formatearFecha(p.fecha_vencimiento)} ({textoVencimiento(p.fecha_vencimiento)})
//                   </small>
//                 </div>
//                 {sancionados.has(p.id) ? (
//                   <small className="muted soc-nota">Ya sancionado</small>
//                 ) : (
//                   <button className="inv-accion peligro" onClick={() => abrirForm(p.id)}>
//                     Sancionar
//                   </button>
//                 )}
//               </li>
//             ))}
//           </ul>
//         )}

//         {/* --- Aplicar sanción --- */}
//         {formAbierto ? (
//           <SancionForm
//             socio={socio}
//             prestamoInicial={prestamoId}
//             sancionados={sancionados}
//             usuarioId={usuarioId}
//             onCancelar={() => setFormAbierto(false)}
//             onAplicada={(texto) => {
//               setFormAbierto(false);
//               onCambio(texto);
//             }}
//           />
//         ) : (
//           <div className="modal-actions">
//             <button className="ghost-btn" onClick={onCerrar}>
//               Cerrar
//             </button>
//             <button className="confirm-reservation" onClick={() => abrirForm(socio.vencidos.find((p) => !sancionados.has(p.id))?.id ?? '')}>
//               APLICAR SANCIÓN
//             </button>
//           </div>
//         )}
//       </section>
//     </div>
//   );
// }

// /** Formulario de sanción: siempre sobre un préstamo del socio (así lo pide el backend). */
// function SancionForm({
//   socio,
//   prestamoInicial,
//   sancionados,
//   usuarioId,
//   onCancelar,
//   onAplicada,
// }: {
//   socio: SocioVista;
//   prestamoInicial: number | '';
//   sancionados: Set<number>;
//   usuarioId: number;
//   onCancelar: () => void;
//   onAplicada: (aviso: string) => void;
// }) {
//   // Vencidos primero; después el resto, del más nuevo al más viejo
//   const opciones = useMemo(
//     () =>
//       [...socio.prestamos].sort(
//         (a, b) => Number(estaAtrasado(b)) - Number(estaAtrasado(a)) || b.fecha_vencimiento.localeCompare(a.fecha_vencimiento),
//       ),
//     [socio.prestamos],
//   );
//   const [prestamoId, setPrestamoId] = useState<number | ''>(prestamoInicial);
//   const [tipo, setTipo] = useState<SancionTipo>(SancionTipo.MULTA);
//   const [monto, setMonto] = useState('');
//   const [dias, setDias] = useState('');
//   const [motivo, setMotivo] = useState('');
//   const [motivoTocado, setMotivoTocado] = useState(false);
//   const [errores, setErrores] = useState<{ prestamo?: string; valor?: string; motivo?: string }>({});
//   const [errorApi, setErrorApi] = useState<string | null>(null);
//   const [guardando, setGuardando] = useState(false);

//   const prestamo = opciones.find((p) => p.id === prestamoId) ?? null;
//   const habilitado = socio.estado === SocioEstado.ACTIVO;

//   // Motivo sugerido según el préstamo elegido (si no lo escribieron a mano)
//   useEffect(() => {
//     if (motivoTocado) return;
//     setMotivo(
//       prestamo
//         ? estaAtrasado(prestamo)
//           ? `Retraso en la devolución del préstamo ${prestamo.numero}`
//           : `Sanción sobre el préstamo ${prestamo.numero}`
//         : '',
//     );
//   }, [prestamo, motivoTocado]);

//   const guardar = async (e: FormEvent) => {
//     e.preventDefault();
//     const nuevos: typeof errores = {};
//     const valor = Number(tipo === SancionTipo.MULTA ? monto : dias);
//     if (prestamoId === '') nuevos.prestamo = 'Elegí el préstamo que origina la sanción.';
//     if (tipo === SancionTipo.MULTA && !(valor > 0)) nuevos.valor = 'Ingresá un monto mayor a 0.';
//     if (tipo === SancionTipo.SUSPENSION && !(Number.isInteger(valor) && valor > 0)) nuevos.valor = 'Ingresá una cantidad de días entera mayor a 0.';
//     if (!motivo.trim()) nuevos.motivo = 'Escribí el motivo.';
//     setErrores(nuevos);
//     if (Object.keys(nuevos).length || prestamoId === '') return;

//     setGuardando(true);
//     setErrorApi(null);
//     try {
//       await sociosService.sancionar(
//         {
//           prestamo_id: prestamoId,
//           tipo,
//           motivo: motivo.trim(),
//           monto: tipo === SancionTipo.MULTA ? valor : null,
//           dias_suspension: tipo === SancionTipo.SUSPENSION ? valor : null,
//         },
//         usuarioId,
//       );
//       onAplicada(
//         tipo === SancionTipo.MULTA
//           ? `Multa de ${pesos(valor)} aplicada a ${socio.nombre} ${socio.apellido}.`
//           : `${socio.nombre} ${socio.apellido} quedó suspendido por ${valor} días.`,
//       );
//     } catch (err) {
//       setErrorApi(mensajeDeError(err, 'No se pudo aplicar la sanción.'));
//       setGuardando(false);
//     }
//   };

//   return (
//     <form className="ejemplar-form soc-form" onSubmit={guardar} noValidate>
//       <h3 className="soc-seccion">Aplicar sanción</h3>

//       {!habilitado && (
//         <div className="soc-alerta" role="alert">
//           El socio está <b>{ETIQUETA_ESTADO_SOCIO[socio.estado].toLowerCase()}</b>: el sistema solo permite sancionar a
//           socios activos.
//         </div>
//       )}

//       <label className="campo">
//         <span>Préstamo *</span>
//         <select
//           value={prestamoId}
//           onChange={(e) => {
//             setPrestamoId(e.target.value ? Number(e.target.value) : '');
//             setErrores((x) => ({ ...x, prestamo: undefined }));
//           }}
//           aria-invalid={!!errores.prestamo}
//           disabled={!habilitado}
//         >
//           <option value="">{opciones.length ? 'Elegí un préstamo' : 'El socio no tiene préstamos'}</option>
//           {opciones.map((p) => (
//             <option key={p.id} value={p.id} disabled={sancionados.has(p.id)}>
//               {p.numero} · {p.ejemplar_codigo} · vence {formatearFecha(p.fecha_vencimiento)}
//               {estaAtrasado(p) ? ' · VENCIDO' : p.estado === PrestamoEstado.FINALIZADO ? ' · devuelto' : ''}
//               {sancionados.has(p.id) ? ' · ya sancionado' : ''}
//             </option>
//           ))}
//         </select>
//         {errores.prestamo && <small className="campo-error">{errores.prestamo}</small>}
//       </label>

//       <div className="campo">
//         <span>Tipo de sanción</span>
//         <div className="pickup-options soc-tipos">
//           {[SancionTipo.MULTA, SancionTipo.SUSPENSION].map((t) => (
//             <label key={t} className={tipo === t ? 'selected' : ''}>
//               <input
//                 type="radio"
//                 name="tipo-sancion"
//                 checked={tipo === t}
//                 onChange={() => {
//                   setTipo(t);
//                   setErrores((x) => ({ ...x, valor: undefined }));
//                 }}
//                 disabled={!habilitado}
//               />
//               <span className="radio-mark" />
//               <div>
//                 <strong>{ETIQUETA_SANCION[t]}</strong>
//                 <small className="available-now">
//                   {t === SancionTipo.MULTA ? 'Monto a pagar en pesos' : 'Días sin poder pedir libros'}
//                 </small>
//               </div>
//             </label>
//           ))}
//         </div>
//       </div>

//       <div className="ejemplar-form-fila">
//         <label className="campo">
//           <span>{tipo === SancionTipo.MULTA ? 'Monto ($) *' : 'Días de suspensión *'}</span>
//           <input
//             type="number"
//             min={1}
//             step={tipo === SancionTipo.MULTA ? 'any' : 1}
//             inputMode={tipo === SancionTipo.MULTA ? 'decimal' : 'numeric'}
//             value={tipo === SancionTipo.MULTA ? monto : dias}
//             onChange={(e) => {
//               if (tipo === SancionTipo.MULTA) setMonto(e.target.value);
//               else setDias(e.target.value);
//               setErrores((x) => ({ ...x, valor: undefined }));
//             }}
//             placeholder={tipo === SancionTipo.MULTA ? 'Ej. 1500' : 'Ej. 7'}
//             aria-invalid={!!errores.valor}
//             disabled={!habilitado}
//           />
//           {errores.valor && <small className="campo-error">{errores.valor}</small>}
//         </label>
//         <label className="campo">
//           <span>Motivo *</span>
//           <input
//             value={motivo}
//             onChange={(e) => {
//               setMotivo(e.target.value);
//               setMotivoTocado(true);
//               setErrores((x) => ({ ...x, motivo: undefined }));
//             }}
//             placeholder="Ej. Retraso en la devolución"
//             aria-invalid={!!errores.motivo}
//             disabled={!habilitado}
//           />
//           {errores.motivo && <small className="campo-error">{errores.motivo}</small>}
//         </label>
//       </div>

//       {errorApi && (
//         <div className="login-error" role="alert">
//           {errorApi}
//         </div>
//       )}

//       <div className="modal-actions">
//         <button type="button" className="ghost-btn" onClick={onCancelar} disabled={guardando}>
//           Cancelar
//         </button>
//         <button type="submit" className="confirm-reservation" disabled={guardando || !habilitado}>
//           {guardando ? 'APLICANDO…' : tipo === SancionTipo.MULTA ? 'APLICAR MULTA' : 'APLICAR SUSPENSIÓN'}
//         </button>
//       </div>
//     </form>
//   );
// }

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { sociosService } from '../../services/sociosService';
import { PrestamoEstado,RolNombre, SancionTipo, SocioEstado } from '../../types/enums';
import type { PrestamoListado } from '../../types/mostrador';
import { ETIQUETA_ESTADO_SOCIO, ETIQUETA_SANCION, type Sancion, type Socio } from '../../types/socios';
import { diasHasta, formatearFecha, textoVencimiento } from '../../utils/fechas';
import AdminIcon from '../admin/AdminIcon';
import { mensajeDeError } from '../mostrador/avisos';
import { useAuth } from '../../context/AuthContext';
import ResetPasswordModal from '../admin/ResetPasswordModal';

/** Socio con sus préstamos y sanciones vigentes ya cruzados (lo arma SociosPage). */
export interface SocioVista extends Socio {
  prestamos: PrestamoListado[];
  abiertos: number;
  vencidos: PrestamoListado[];
  sanciones: Sancion[];
}

/** Préstamo atrasado: VENCIDO según el backend, o ACTIVO con la fecha ya pasada. */
export function estaAtrasado(p: PrestamoListado): boolean {
  return p.estado === PrestamoEstado.VENCIDO || (p.estado === PrestamoEstado.ACTIVO && diasHasta(p.fecha_vencimiento) < 0);
}

interface Props {
  socio: SocioVista;
  usuarioId: number;
  onCerrar: () => void;
  onCambio: (aviso: string) => void;
}

const pesos = (n: number) => `$${n.toLocaleString('es-AR')}`;

/**
 * F8.4 – Ficha del socio: préstamos vencidos, sanciones vigentes (con "Levantar") y el
 * formulario para aplicar una MULTA (con monto) o una SUSPENSION (con días) sobre un préstamo.
 */
export default function SocioFichaModal({ socio, usuarioId, onCerrar, onCambio }: Props) {
  const [formAbierto, setFormAbierto] = useState(false);
  const [prestamoId, setPrestamoId] = useState<number | ''>('');
  const [sancionALevantar, setSancionALevantar] = useState<Sancion | null>(null);
  const [levantando, setLevantando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { rol } = useAuth();
  const esAdmin = rol === RolNombre.ADMINISTRADOR;
  const [resetClaveAbierto, setResetClaveAbierto] = useState(false);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || levantando) return;
      if (sancionALevantar) setSancionALevantar(null);
      else onCerrar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar, sancionALevantar, levantando]);

  const numeroDe = (id: number) => socio.prestamos.find((p) => p.id === id)?.numero ?? `#${id}`;
  const sancionados = new Set(socio.sanciones.map((s) => s.prestamo_id));

  const abrirForm = (id: number | '') => {
    setPrestamoId(id);
    setFormAbierto(true);
    setError(null);
  };

  const levantar = async (s: Sancion) => {
    setLevantando(true);
    setError(null);
    try {
      await sociosService.levantar(s.id, usuarioId);
      setSancionALevantar(null);
      onCambio(`Se levantó la ${ETIQUETA_SANCION[s.tipo].toLowerCase()} de ${socio.nombre} ${socio.apellido}.`);
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo levantar la sanción.'));
      setSancionALevantar(null);
    } finally {
      setLevantando(false);
    }
  };

  const filaDato = (etiqueta: string, valor: string, mono = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5 }}>
      <span className="muted">{etiqueta}</span>
      <strong className={mono ? 'mono' : undefined} style={{ textAlign: 'right' }}>
        {valor}
      </strong>
    </div>
  );

  return (
    <div className="reservation-modal-backdrop" role="presentation">
      <section className="reservation-modal soc-ficha" role="dialog" aria-modal="true" aria-labelledby="ficha-title">
        <button className="modal-close" onClick={onCerrar} aria-label="Cerrar">
          <AdminIcon name="close" size={18} />
        </button>
        <span className="eyebrow">FICHA DE SOCIO</span>
        <h2 id="ficha-title" className="soc-ficha-titulo">
          {socio.apellido}, {socio.nombre}
          <span className={`estado-pill est-soc-${socio.estado.toLowerCase()}`}>
            <i aria-hidden="true" />
            {ETIQUETA_ESTADO_SOCIO[socio.estado]}
          </span>
        </h2>
        <p className="muted soc-ficha-sub">
          {socio.nombre_usuario && (
            <>
              <strong className="mono" style={{ color: 'var(--ink)' }}>
                @{socio.nombre_usuario}
              </strong>{' '}
              ·{' '}
            </>
          )}
          N° {socio.id} · DNI {socio.dni}
          {socio.telefono ? ` · Tel. ${socio.telefono}` : ''}
        </p>

        <div className="soc-datos">
          <div>
            <span>Préstamos abiertos</span>
            <strong>{socio.abiertos}</strong>
          </div>
          <div>
            <span>Vencidos</span>
            <strong className={socio.vencidos.length ? 'mal' : ''}>{socio.vencidos.length}</strong>
          </div>
          <div>
            <span>Sanciones vigentes</span>
            <strong className={socio.sanciones.length ? 'mal' : ''}>{socio.sanciones.length}</strong>
          </div>
        </div>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        {/* --- Sanciones vigentes --- */}
        <h3 className="soc-seccion">Sanciones vigentes</h3>
        {socio.sanciones.length === 0 ? (
          <p className="soc-vacio">No tiene sanciones vigentes.</p>
        ) : (
          <ul className="soc-lista">
            {socio.sanciones.map((s) => (
              <li key={s.id}>
                <div>
                  <span className={`soc-sancion ${s.tipo.toLowerCase()}`}>{ETIQUETA_SANCION[s.tipo]}</span>
                  <strong>
                    {s.tipo === SancionTipo.MULTA && s.monto != null && pesos(s.monto)}
                    {s.tipo === SancionTipo.SUSPENSION && s.dias_suspension != null && `${s.dias_suspension} días`}
                    {s.tipo === SancionTipo.REPOSICION && 'Hasta regularizar el libro'}
                  </strong>
                  <small>
                    {s.motivo} · Préstamo {numeroDe(s.prestamo_id)} · desde {formatearFecha(s.fecha_inicio)}
                    {s.fecha_fin ? ` hasta ${formatearFecha(s.fecha_fin)}` : ''}
                  </small>
                </div>
                {s.tipo === 'REPOSICION' ? (
                  <small className="muted soc-nota">Se levanta al reponer el libro</small>
                ) : aLevantar === s.id ? (
                  <span className="inv-acciones">
                    <button className="inv-accion" onClick={() => setALevantar(null)} disabled={levantando}>
                      No
                    </button>
                    <button className="inv-accion ok" onClick={() => void levantar(s)} disabled={levantando}>
                      {levantando ? 'Levantando…' : 'Sí, levantar'}
                    </button>
                  </span>
                ) : (
                  <button className="inv-accion" onClick={() => setALevantar(s.id)}>
                    Levantar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* --- Préstamos vencidos --- */}
        <h3 className="soc-seccion">Préstamos vencidos</h3>
        {socio.vencidos.length === 0 ? (
          <p className="soc-vacio">No tiene préstamos vencidos.</p>
        ) : (
          <ul className="soc-lista">
            {socio.vencidos.map((p) => (
              <li key={p.id} className="atrasado">
                <div>
                  <strong className="mono">{p.numero}</strong>
                  <small>
                    Ejemplar <span className="mono">{p.ejemplar_codigo}</span> · venció el{' '}
                    {formatearFecha(p.fecha_vencimiento)} ({textoVencimiento(p.fecha_vencimiento)})
                  </small>
                </div>
                {sancionados.has(p.id) ? (
                  <small className="muted soc-nota">Ya sancionado</small>
                ) : (
                  <button className="inv-accion peligro" onClick={() => abrirForm(p.id)}>
                    Sancionar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* --- Aplicar sanción --- */}
        {formAbierto ? (
          <SancionForm
            socio={socio}
            prestamoInicial={prestamoId}
            sancionados={sancionados}
            usuarioId={usuarioId}
            onCancelar={() => setFormAbierto(false)}
            onAplicada={(texto) => {
              setFormAbierto(false);
              onCambio(texto);
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              marginTop: 22,
            }}
          >
            <button
              type="button"
              className="confirm-reservation"
              onClick={() => abrirForm(socio.vencidos.find((p) => !sancionados.has(p.id))?.id ?? '')}
              style={{ width: '100%', marginTop: 0, borderRadius: 0 }}
            >
              APLICAR SANCIÓN
            </button>
            {esAdmin && socio.usuario_id && (
  <button
    type="button"
    onClick={() => setResetClaveAbierto(true)}
    style={{
      width: '100%',
      padding: '14px 18px',
      fontFamily: 'inherit',
      fontSize: 13,
      fontWeight: 700,
      borderRadius: 0,
      background: '#fff',
      color: 'var(--green)',
      border: '1px solid var(--green)',
      cursor: 'pointer',
    }}
  >
    Restablecer contraseña
  </button>
)}
            <button
              type="button"
              onClick={onCerrar}
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
              Cerrar
            </button>
          </div>
        )}
      </section>
      {resetClaveAbierto && socio.usuario_id && (
  <ResetPasswordModal
    usuarioId={socio.usuario_id}
    nombrePersona={`${socio.nombre} ${socio.apellido}`}
    nombreUsuario={socio.nombre_usuario}
    onCerrar={() => setResetClaveAbierto(false)}
    onGuardada={(texto) => {
      setResetClaveAbierto(false);
      onCambio(texto);
    }}
  />
)}

      {/* --- Ventana de confirmación para levantar sanción --- */}
      {sancionALevantar && (
        <div
          className="reservation-modal-backdrop"
          role="presentation"
          style={{ zIndex: 1100 }}
        >
          <section
            className="reservation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="levantar-sancion-title"
          >
            <button
              className="modal-close"
              onClick={() => setSancionALevantar(null)}
              aria-label="Cerrar"
              disabled={levantando}
            >
              <AdminIcon name="close" size={18} />
            </button>
            <span className="eyebrow">LEVANTAR SANCIÓN</span>
            <h2 id="levantar-sancion-title">¿Confirmás levantar esta sanción?</h2>

            <div
              style={{
                display: 'grid',
                gap: 10,
                padding: '14px 16px',
                border: '1px solid rgba(29, 36, 32, .14)',
                background: '#fff',
                marginTop: 14,
              }}
            >
              {filaDato(
                'Socio',
                socio.nombre_usuario
                  ? `@${socio.nombre_usuario} (${socio.apellido}, ${socio.nombre})`
                  : `${socio.apellido}, ${socio.nombre}`,
              )}
              {filaDato('Tipo de sanción', ETIQUETA_SANCION[sancionALevantar.tipo])}
              {sancionALevantar.tipo === SancionTipo.MULTA &&
                sancionALevantar.monto != null &&
                filaDato('Monto', pesos(sancionALevantar.monto), true)}
              {sancionALevantar.tipo === SancionTipo.SUSPENSION &&
                sancionALevantar.dias_suspension != null &&
                filaDato('Duración', `${sancionALevantar.dias_suspension} días`)}
              {filaDato('Préstamo asociado', numeroDe(sancionALevantar.prestamo_id), true)}
              {filaDato(
                'Vigencia',
                sancionALevantar.fecha_fin
                  ? `${formatearFecha(sancionALevantar.fecha_inicio)} al ${formatearFecha(sancionALevantar.fecha_fin)}`
                  : `Desde ${formatearFecha(sancionALevantar.fecha_inicio)}`,
              )}
              {filaDato('Motivo', sancionALevantar.motivo)}
            </div>

            <p className="ejemplar-resumen mos-resumen">
              La sanción quedará sin efecto y el socio volverá a estar habilitado para operar.
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                marginTop: 20,
              }}
            >
              <button
                type="button"
                className="confirm-reservation"
                onClick={() => void levantar(sancionALevantar)}
                disabled={levantando}
                style={{ width: '100%', marginTop: 0, borderRadius: 0 }}
              >
                {levantando ? 'LEVANTANDO…' : 'SÍ, LEVANTAR SANCIÓN'}
              </button>
              <button
                type="button"
                onClick={() => setSancionALevantar(null)}
                disabled={levantando}
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
          </section>
        </div>
      )}
    </div>
  );
}

/** Formulario de sanción: siempre sobre un préstamo del socio (así lo pide el backend). */
function SancionForm({
  socio,
  prestamoInicial,
  sancionados,
  usuarioId,
  onCancelar,
  onAplicada,
}: {
  socio: SocioVista;
  prestamoInicial: number | '';
  sancionados: Set<number>;
  usuarioId: number;
  onCancelar: () => void;
  onAplicada: (aviso: string) => void;
}) {
  // Vencidos primero; después el resto, del más nuevo al más viejo
  const opciones = useMemo(
    () =>
      [...socio.prestamos].sort(
        (a, b) => Number(estaAtrasado(b)) - Number(estaAtrasado(a)) || b.fecha_vencimiento.localeCompare(a.fecha_vencimiento),
      ),
    [socio.prestamos],
  );
  const [prestamoId, setPrestamoId] = useState<number | ''>(prestamoInicial);
  const [tipo, setTipo] = useState<SancionTipo>(SancionTipo.MULTA);
  const [monto, setMonto] = useState('');
  const [dias, setDias] = useState('');
  const [motivo, setMotivo] = useState('');
  const [motivoTocado, setMotivoTocado] = useState(false);
  const [errores, setErrores] = useState<{ prestamo?: string; valor?: string; motivo?: string }>({});
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const prestamo = opciones.find((p) => p.id === prestamoId) ?? null;
  const habilitado = socio.estado === SocioEstado.ACTIVO;

  // Motivo sugerido según el préstamo elegido (si no lo escribieron a mano)
  useEffect(() => {
    if (motivoTocado) return;
    setMotivo(
      prestamo
        ? estaAtrasado(prestamo)
          ? `Retraso en la devolución del préstamo ${prestamo.numero}`
          : `Sanción sobre el préstamo ${prestamo.numero}`
        : '',
    );
  }, [prestamo, motivoTocado]);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const nuevos: typeof errores = {};
    const valor = Number(tipo === SancionTipo.MULTA ? monto : dias);
    if (prestamoId === '') nuevos.prestamo = 'Elegí el préstamo que origina la sanción.';
    if (tipo === SancionTipo.MULTA && !(valor > 0)) nuevos.valor = 'Ingresá un monto mayor a 0.';
    if (tipo === SancionTipo.SUSPENSION && !(Number.isInteger(valor) && valor > 0))
      nuevos.valor = 'Ingresá una cantidad de días entera mayor a 0.';
    if (!motivo.trim()) nuevos.motivo = 'Escribí el motivo.';
    setErrores(nuevos);
    if (Object.keys(nuevos).length || prestamoId === '') return;

    setGuardando(true);
    setErrorApi(null);
    try {
      await sociosService.sancionar(
        {
          prestamo_id: prestamoId,
          tipo,
          motivo: motivo.trim(),
          monto: tipo === SancionTipo.MULTA ? valor : null,
          dias_suspension: tipo === SancionTipo.SUSPENSION ? valor : null,
        },
        usuarioId,
      );
      onAplicada(
        tipo === SancionTipo.MULTA
          ? `Multa de ${pesos(valor)} aplicada a ${socio.nombre} ${socio.apellido}.`
          : `${socio.nombre} ${socio.apellido} quedó suspendido por ${valor} días.`,
      );
    } catch (err) {
      setErrorApi(mensajeDeError(err, 'No se pudo aplicar la sanción.'));
      setGuardando(false);
    }
  };

  return (
    <form className="ejemplar-form soc-form" onSubmit={guardar} noValidate>
      <h3 className="soc-seccion">Aplicar sanción</h3>

      {!habilitado && (
        <div className="soc-alerta" role="alert">
          El socio está <b>{ETIQUETA_ESTADO_SOCIO[socio.estado].toLowerCase()}</b>: el sistema solo permite sancionar a
          socios activos.
        </div>
      )}

      <label className="campo">
        <span>Préstamo *</span>
        <select
          value={prestamoId}
          onChange={(e) => {
            setPrestamoId(e.target.value ? Number(e.target.value) : '');
            setErrores((x) => ({ ...x, prestamo: undefined }));
          }}
          aria-invalid={!!errores.prestamo}
          disabled={!habilitado}
        >
          <option value="">{opciones.length ? 'Elegí un préstamo' : 'El socio no tiene préstamos'}</option>
          {opciones.map((p) => (
            <option key={p.id} value={p.id} disabled={sancionados.has(p.id)}>
              {p.numero} · {p.ejemplar_codigo} · vence {formatearFecha(p.fecha_vencimiento)}
              {estaAtrasado(p) ? ' · VENCIDO' : p.estado === PrestamoEstado.FINALIZADO ? ' · devuelto' : ''}
              {sancionados.has(p.id) ? ' · ya sancionado' : ''}
            </option>
          ))}
        </select>
        {errores.prestamo && <small className="campo-error">{errores.prestamo}</small>}
      </label>

      <div className="campo">
        <span>Tipo de sanción</span>
        <div className="pickup-options soc-tipos">
          {[SancionTipo.MULTA, SancionTipo.SUSPENSION].map((t) => (
            <label key={t} className={tipo === t ? 'selected' : ''}>
              <input
                type="radio"
                name="tipo-sancion"
                checked={tipo === t}
                onChange={() => {
                  setTipo(t);
                  setErrores((x) => ({ ...x, valor: undefined }));
                }}
                disabled={!habilitado}
              />
              <span className="radio-mark" />
              <div>
                <strong>{ETIQUETA_SANCION[t]}</strong>
                <small className="available-now">
                  {t === SancionTipo.MULTA ? 'Monto a pagar en pesos' : 'Días sin poder pedir libros'}
                </small>
              </div>
            </label>
          ))}
        </div>
      </div>

      <p className="muted">
        La baja por libro perdido (REPOSICIÓN) no se aplica desde este formulario: se registra al dar por perdido el
        préstamo y deja al socio de baja hasta reponer el libro o devolverlo y abonar la multa.
      </p>

      <div className="ejemplar-form-fila">
        <label className="campo">
          <span>{tipo === SancionTipo.MULTA ? 'Monto ($) *' : 'Días de suspensión *'}</span>
          <input
            type="number"
            min={1}
            step={tipo === SancionTipo.MULTA ? 'any' : 1}
            inputMode={tipo === SancionTipo.MULTA ? 'decimal' : 'numeric'}
            value={tipo === SancionTipo.MULTA ? monto : dias}
            onChange={(e) => {
              if (tipo === SancionTipo.MULTA) setMonto(e.target.value);
              else setDias(e.target.value);
              setErrores((x) => ({ ...x, valor: undefined }));
            }}
            placeholder={tipo === SancionTipo.MULTA ? 'Ej. 1500' : 'Ej. 7'}
            aria-invalid={!!errores.valor}
            disabled={!habilitado}
          />
          {errores.valor && <small className="campo-error">{errores.valor}</small>}
        </label>
        <label className="campo">
          <span>Motivo *</span>
          <input
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              setMotivoTocado(true);
              setErrores((x) => ({ ...x, motivo: undefined }));
            }}
            placeholder="Ej. Retraso en la devolución"
            aria-invalid={!!errores.motivo}
            disabled={!habilitado}
          />
          {errores.motivo && <small className="campo-error">{errores.motivo}</small>}
        </label>
      </div>

      {errorApi && (
        <div className="login-error" role="alert">
          {errorApi}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginTop: 20,
        }}
      >
        <button
          type="submit"
          className="confirm-reservation"
          disabled={guardando || !habilitado}
          style={{ width: '100%', marginTop: 0, borderRadius: 0 }}
        >
          {guardando ? 'APLICANDO…' : tipo === SancionTipo.MULTA ? 'APLICAR MULTA' : 'APLICAR SUSPENSIÓN'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
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
  );
}