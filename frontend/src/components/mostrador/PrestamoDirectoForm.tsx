// import { useEffect, useId, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
// import { ApiError } from '../../services/api';
// import { mostradorService } from '../../services/mostradorService';
// import type { EjemplarInventario } from '../../types/ejemplares';
// import { EjemplarEstado, PrestamoEstado, PrestamoTipo } from '../../types/enums';
// import type { LibroListado } from '../../types/libros';
// import {
//   ETIQUETA_TIPO_PRESTAMO,
//   MAX_PRESTAMOS_ABIERTOS,
//   type PrestamoListado,
//   type SancionVigente,
// } from '../../types/mostrador';
// import { diasHasta, formatearFecha } from '../../utils/fechas';
// import { normalizar } from '../../utils/texto';
// import AdminIcon from '../admin/AdminIcon';
// import type { Aviso } from './avisos';
// import SocioSelector, { type SocioElegido } from './SocioSelector';

// interface Props {
//   sedeId: number;
//   sedeNombre: string;
//   libros: LibroListado[];
//   ejemplares: EjemplarInventario[];
//   onAviso: (aviso: Aviso) => void;
//   onCambio: () => void;
// }

// /** Situación del socio antes de prestar (sale de endpoints que ya existen). */
// interface Situacion {
//   cargando: boolean;
//   abiertos: PrestamoListado[];
//   sanciones: SancionVigente[];
//   error: string | null;
// }

// /** Error de negocio devuelto al confirmar, con título según la regla que se violó. */
// interface Alerta {
//   titulo: string;
//   texto: string;
// }

// function alertaDeError(e: unknown): Alerta {
//   if (!(e instanceof ApiError)) {
//     return { titulo: 'Sin conexión', texto: 'No se pudo conectar con el servidor. Verificá que el backend esté levantado.' };
//   }
//   // prestamo_controller: SocioSancionado -> 403, LimitePrestamosExcedido -> 409
//   if (e.status === 403) return { titulo: 'Socio sancionado', texto: e.message };
//   if (e.status === 409 && /l[ií]mite/i.test(e.message)) return { titulo: 'Límite de préstamos alcanzado', texto: e.message };
//   if (e.status === 409) return { titulo: 'El ejemplar no se puede prestar', texto: e.message };
//   return { titulo: 'No se pudo registrar el préstamo', texto: e.message };
// }

// const MAX_SUGERENCIAS = 8;

// /**
//  * F7.2 – Préstamo directo en el mostrador: un ejemplar DISPONIBLE de la sede para un socio.
//  * Antes de confirmar avisa si el socio tiene sanción vigente o llegó al límite; si el backend
//  * igual rechaza (SocioSancionado, LimitePrestamosExcedido), muestra la alerta correspondiente.
//  */
// export default function PrestamoDirectoForm({ sedeId, sedeNombre, libros, ejemplares, onAviso, onCambio }: Props) {
//   const [socio, setSocio] = useState<SocioElegido | null>(null);
//   const [ejemplarId, setEjemplarId] = useState<number | null>(null);
//   const [tipo, setTipo] = useState<PrestamoTipo>(PrestamoTipo.LOCAL);
//   const [tipoTocado, setTipoTocado] = useState(false);
//   const [observaciones, setObservaciones] = useState('');
//   const [errores, setErrores] = useState<{ socio?: string; ejemplar?: string }>({});
//   const [alerta, setAlerta] = useState<Alerta | null>(null);
//   const [guardando, setGuardando] = useState(false);
//   const [situacion, setSituacion] = useState<Situacion | null>(null);

//   const disponibles = useMemo(
//     () => ejemplares.filter((e) => e.estado === EjemplarEstado.DISPONIBLE && e.sede_actual_id === sedeId),
//     [ejemplares, sedeId],
//   );
//   const ejemplar = disponibles.find((e) => e.id === ejemplarId) ?? null;

//   // Si cambia la sede o el ejemplar dejó de estar disponible, se descarta la elección
//   useEffect(() => {
//     if (ejemplarId !== null && !ejemplar) setEjemplarId(null);
//   }, [ejemplarId, ejemplar]);

//   // Tipo sugerido: si el ejemplar es de otra sede (llegó por remito) es interbibliotecario
//   useEffect(() => {
//     if (ejemplar && !tipoTocado) {
//       setTipo(ejemplar.sede_origen_id !== sedeId ? PrestamoTipo.INTERBIBLIOTECARIO : PrestamoTipo.LOCAL);
//     }
//   }, [ejemplar, sedeId, tipoTocado]);

//   // Situación del socio: préstamos abiertos y sanciones vigentes
//   const socioId = socio?.id ?? null;
//   useEffect(() => {
//     if (socioId === null) {
//       setSituacion(null);
//       return;
//     }
//     let vigente = true;
//     setSituacion({ cargando: true, abiertos: [], sanciones: [], error: null });
//     Promise.all([mostradorService.prestamosDeSocio(socioId), mostradorService.sancionesVigentes(socioId)])
//       .then(([prestamos, sanciones]) => {
//         if (!vigente) return;
//         setSituacion({
//           cargando: false,
//           abiertos: prestamos.filter((p) => p.estado !== PrestamoEstado.FINALIZADO),
//           sanciones,
//           error: null,
//         });
//       })
//       .catch(() => {
//         if (vigente)
//           setSituacion({
//             cargando: false,
//             abiertos: [],
//             sanciones: [],
//             error: 'No se pudo consultar la situación del socio; el backend la valida igual al confirmar.',
//           });
//       });
//     return () => {
//       vigente = false;
//     };
//   }, [socioId]);

//   const sancionado = (situacion?.sanciones.length ?? 0) > 0;
//   const enLimite = (situacion?.abiertos.length ?? 0) >= MAX_PRESTAMOS_ABIERTOS;
//   // Atrasados: VENCIDO según el backend, o ACTIVO con la fecha ya pasada
//   const vencidos =
//     situacion?.abiertos.filter((p) => p.estado === PrestamoEstado.VENCIDO || diasHasta(p.fecha_vencimiento) < 0).length ?? 0;
//   const bloqueado = sancionado || enLimite;

//   const limpiar = () => {
//     setEjemplarId(null);
//     setObservaciones('');
//     setTipoTocado(false);
//     setAlerta(null);
//     setErrores({});
//   };

//   const guardar = async (e: FormEvent) => {
//     e.preventDefault();
//     const nuevos: typeof errores = {};
//     if (!socio) nuevos.socio = 'Elegí el socio.';
//     if (!ejemplar) nuevos.ejemplar = 'Elegí un ejemplar disponible.';
//     setErrores(nuevos);
//     if (!socio || !ejemplar) return;

//     setGuardando(true);
//     setAlerta(null);
//     try {
//       const prestamo = await mostradorService.crearPrestamo({
//         socio_id: socio.id,
//         ejemplar_id: ejemplar.id,
//         tipo,
//         observaciones: observaciones.trim() || null,
//       });
//       onAviso({
//         tipo: 'ok',
//         texto: `Préstamo ${prestamo.numero} registrado: "${ejemplar.libro.nombre}" (${ejemplar.codigo_inventario}) vence el ${formatearFecha(prestamo.fecha_vencimiento)}.`,
//       });
//       limpiar();
//       setSocio(null);
//       onCambio();
//     } catch (err) {
//       setAlerta(alertaDeError(err));
//     } finally {
//       setGuardando(false);
//     }
//   };

//   return (
//     <form className="ejemplar-form mos-form" onSubmit={guardar} noValidate>
//       <div className="mos-form-grid">
//         {/* --- Columna izquierda: socio y su situación --- */}
//         <div className="mos-form-col">
//           <div className="campo">
//             <span>Socio *</span>
//             <SocioSelector
//               value={socio}
//               onChange={(s) => {
//                 setSocio(s);
//                 setAlerta(null);
//                 setErrores((x) => ({ ...x, socio: undefined }));
//               }}
//               invalido={!!errores.socio}
//             />
//             {errores.socio && <small className="campo-error">{errores.socio}</small>}
//           </div>

//           {situacion && (
//             <div className="mos-situacion" aria-live="polite">
//               {situacion.cargando ? (
//                 <small className="muted">Consultando préstamos y sanciones del socio…</small>
//               ) : situacion.error ? (
//                 <small className="muted">{situacion.error}</small>
//               ) : (
//                 <>
//                   <div className="mos-situacion-datos">
//                     <div>
//                       <span>Préstamos abiertos</span>
//                       <strong className={enLimite ? 'mal' : ''}>
//                         {situacion.abiertos.length} / {MAX_PRESTAMOS_ABIERTOS}
//                       </strong>
//                     </div>
//                     <div>
//                       <span>Vencidos</span>
//                       <strong className={vencidos ? 'mal' : ''}>{vencidos}</strong>
//                     </div>
//                     <div>
//                       <span>Sanciones vigentes</span>
//                       <strong className={sancionado ? 'mal' : ''}>{situacion.sanciones.length}</strong>
//                     </div>
//                   </div>

//                   {sancionado && (
//                     <div className="mos-alerta error" role="alert">
//                       <strong>Socio bloqueado: tiene una sanción vigente</strong>
//                       {situacion.sanciones.map((s) => (
//                         <span key={s.id}>
//                           {s.tipo}
//                           {s.monto != null ? ` de $${s.monto.toLocaleString('es-AR')}` : ''}
//                           {s.dias_suspension ? ` (${s.dias_suspension} días)` : ''} · {s.motivo}
//                           {s.fecha_fin ? ` · hasta el ${formatearFecha(s.fecha_fin)}` : ''}
//                         </span>
//                       ))}
//                     </div>
//                   )}
//                   {!sancionado && enLimite && (
//                     <div className="mos-alerta error" role="alert">
//                       <strong>Alcanzó el límite de {MAX_PRESTAMOS_ABIERTOS} préstamos abiertos</strong>
//                       <span>Tiene que devolver un libro antes de llevarse otro.</span>
//                     </div>
//                   )}
//                   {!bloqueado && vencidos > 0 && (
//                     <div className="mos-alerta aviso">
//                       <strong>Tiene préstamos vencidos</strong>
//                       <span>Al devolverlos se le va a aplicar la sanción por retraso.</span>
//                     </div>
//                   )}
//                   {!bloqueado && vencidos === 0 && (
//                     <div className="mos-alerta ok">
//                       <strong>Habilitado para pedir prestado</strong>
//                     </div>
//                   )}
//                 </>
//               )}
//             </div>
//           )}
//         </div>

//         {/* --- Columna derecha: ejemplar y tipo --- */}
//         <div className="mos-form-col">
//           <div className="campo">
//             <span>Ejemplar disponible en {sedeNombre} *</span>
//             <EjemplarSelector
//               ejemplares={disponibles}
//               libros={libros}
//               value={ejemplarId}
//               onChange={(id) => {
//                 setEjemplarId(id);
//                 setAlerta(null);
//                 setErrores((x) => ({ ...x, ejemplar: undefined }));
//               }}
//               invalido={!!errores.ejemplar}
//             />
//             {errores.ejemplar && <small className="campo-error">{errores.ejemplar}</small>}
//             {!disponibles.length && (
//               <small className="campo-ayuda">No hay ejemplares disponibles en esta sede ahora mismo.</small>
//             )}
//           </div>

//           <div className="campo">
//             <span>Tipo de préstamo</span>
//             <div className="pickup-options mos-tipos">
//               {[PrestamoTipo.LOCAL, PrestamoTipo.INTERBIBLIOTECARIO].map((t) => (
//                 <label key={t} className={tipo === t ? 'selected' : ''}>
//                   <input
//                     type="radio"
//                     name="tipo-prestamo"
//                     checked={tipo === t}
//                     onChange={() => {
//                       setTipo(t);
//                       setTipoTocado(true);
//                     }}
//                   />
//                   <span className="radio-mark" />
//                   <div>
//                     <strong>{ETIQUETA_TIPO_PRESTAMO[t]}</strong>
//                     <small className="available-now">
//                       {t === PrestamoTipo.LOCAL ? 'El ejemplar es de esta sede' : 'El ejemplar vino de otra sede'}
//                     </small>
//                   </div>
//                 </label>
//               ))}
//             </div>
//           </div>

//           <label className="campo">
//             <span>Observaciones</span>
//             <input
//               value={observaciones}
//               onChange={(e) => setObservaciones(e.target.value)}
//               placeholder="Ej. Se entrega con la tapa algo gastada"
//             />
//           </label>
//         </div>
//       </div>

//       {socio && ejemplar && (
//         <p className="ejemplar-resumen">
//           Se presta <b>{ejemplar.libro.nombre}</b> ({ejemplar.codigo_inventario}) a{' '}
//           <b>{socio.socio ? `${socio.socio.nombre} ${socio.socio.apellido}` : `socio N° ${socio.id}`}</b> como
//           préstamo <b>{ETIQUETA_TIPO_PRESTAMO[tipo].toLowerCase()}</b>. El vencimiento lo calcula el sistema.
//         </p>
//       )}

//       {alerta && (
//         <div className="mos-alerta error" role="alert">
//           <strong>{alerta.titulo}</strong>
//           <span>{alerta.texto}</span>
//         </div>
//       )}

//       <div className="modal-actions">
//         <button type="button" className="ghost-btn" onClick={() => { limpiar(); setSocio(null); }} disabled={guardando}>
//           Limpiar
//         </button>
//         <button type="submit" className="confirm-reservation" disabled={guardando || bloqueado || !!situacion?.cargando}>
//           {guardando ? 'REGISTRANDO…' : bloqueado ? 'SOCIO NO HABILITADO' : 'REGISTRAR PRÉSTAMO'}
//         </button>
//       </div>
//     </form>
//   );
// }

// /** Combobox de ejemplares DISPONIBLES de la sede: busca por código, signatura, título o autor. */
// function EjemplarSelector({
//   ejemplares,
//   libros,
//   value,
//   onChange,
//   invalido,
// }: {
//   ejemplares: EjemplarInventario[];
//   libros: LibroListado[];
//   value: number | null;
//   onChange: (id: number | null) => void;
//   invalido: boolean;
// }) {
//   const listaId = useId();
//   const elegido = ejemplares.find((e) => e.id === value) ?? null;
//   const [texto, setTexto] = useState('');
//   const [abierto, setAbierto] = useState(false);
//   const [activo, setActivo] = useState(0);

//   const autores = useMemo(
//     () => new Map(libros.map((l) => [l.id, l.autores.map((a) => a.nombre).join(', ')])),
//     [libros],
//   );

//   const sugerencias = useMemo(() => {
//     const q = normalizar(texto);
//     const filtrados = q
//       ? ejemplares.filter(
//           (e) =>
//             normalizar(e.codigo_inventario).includes(q) ||
//             normalizar(e.signatura_topografica).includes(q) ||
//             normalizar(e.libro.nombre).includes(q) ||
//             normalizar(autores.get(e.libro_id)).includes(q),
//         )
//       : ejemplares;
//     return filtrados.slice(0, MAX_SUGERENCIAS);
//   }, [ejemplares, texto, autores]);

//   const elegir = (e: EjemplarInventario) => {
//     onChange(e.id);
//     setTexto('');
//     setAbierto(false);
//   };

//   const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
//     if (e.key === 'ArrowDown') {
//       e.preventDefault();
//       setAbierto(true);
//       setActivo((i) => Math.min(i + 1, sugerencias.length - 1));
//     } else if (e.key === 'ArrowUp') {
//       e.preventDefault();
//       setActivo((i) => Math.max(i - 1, 0));
//     } else if (e.key === 'Enter' && abierto && sugerencias[activo]) {
//       e.preventDefault();
//       elegir(sugerencias[activo]);
//     } else if (e.key === 'Escape' && abierto) {
//       e.stopPropagation();
//       setAbierto(false);
//     }
//   };

//   return (
//     <div className={`libro-selector${invalido ? ' invalido' : ''}`}>
//       <label className="admin-search">
//         <AdminIcon name="ejemplares" size={17} />
//         <input
//           role="combobox"
//           aria-label="Ejemplar a prestar"
//           aria-expanded={abierto}
//           aria-controls={listaId}
//           aria-autocomplete="list"
//           value={abierto || !elegido ? texto : `${elegido.codigo_inventario} · ${elegido.libro.nombre}`}
//           placeholder="Código de inventario, título o autor"
//           onChange={(e) => {
//             setTexto(e.target.value);
//             setActivo(0);
//             setAbierto(true);
//           }}
//           onFocus={() => {
//             setTexto('');
//             setAbierto(true);
//           }}
//           onBlur={() => setAbierto(false)}
//           onKeyDown={onKeyDown}
//           disabled={!ejemplares.length}
//         />
//         {elegido && (
//           <button
//             type="button"
//             onMouseDown={(e) => e.preventDefault()}
//             onClick={() => onChange(null)}
//             aria-label="Quitar ejemplar elegido"
//           >
//             <AdminIcon name="close" size={15} />
//           </button>
//         )}
//       </label>
//       {abierto && (
//         <ul className="libro-selector-lista" id={listaId} role="listbox">
//           {sugerencias.length === 0 ? (
//             <li className="vacio">No hay ejemplares disponibles que coincidan</li>
//           ) : (
//             sugerencias.map((e, i) => (
//               <li
//                 key={e.id}
//                 role="option"
//                 aria-selected={i === activo}
//                 className={i === activo ? 'activo' : ''}
//                 onMouseDown={(ev) => ev.preventDefault()}
//                 onMouseEnter={() => setActivo(i)}
//                 onClick={() => elegir(e)}
//               >
//                 <strong>{e.libro.nombre}</strong>
//                 <small>
//                   <span className="mono">{e.codigo_inventario}</span>
//                   {e.signatura_topografica ? ` · ${e.signatura_topografica}` : ''}
//                   {autores.get(e.libro_id) ? ` · ${autores.get(e.libro_id)}` : ''}
//                   {e.sede_origen_id !== e.sede_actual_id ? ` · de ${e.sede_origen.nombre}` : ''}
//                 </small>
//               </li>
//             ))
//           )}
//         </ul>
//       )}
//     </div>
//   );
// }

import { useEffect, useId, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ApiError } from '../../services/api';
import { mostradorService } from '../../services/mostradorService';
import type { EjemplarInventario } from '../../types/ejemplares';
import { EjemplarEstado, PrestamoEstado, PrestamoTipo } from '../../types/enums';
import type { LibroListado } from '../../types/libros';
import {
  ETIQUETA_TIPO_PRESTAMO,
  MAX_PRESTAMOS_ABIERTOS,
  type PrestamoListado,
  type SancionVigente,
} from '../../types/mostrador';
import { diasHasta, formatearFecha } from '../../utils/fechas';
import { normalizar } from '../../utils/texto';
import AdminIcon from '../admin/AdminIcon';
import type { Aviso } from './avisos';
import SocioSelector, { type SocioElegido } from './SocioSelector';

interface Props {
  sedeId: number;
  sedeNombre: string;
  libros: LibroListado[];
  ejemplares: EjemplarInventario[];
  onAviso: (aviso: Aviso) => void;
  onCambio: () => void;
}

/** Situación del socio antes de prestar (sale de endpoints que ya existen). */
interface Situacion {
  cargando: boolean;
  abiertos: PrestamoListado[];
  sanciones: SancionVigente[];
  error: string | null;
}

/** Error de negocio devuelto al confirmar, con título según la regla que se violó. */
interface Alerta {
  titulo: string;
  texto: string;
}

function alertaDeError(e: unknown): Alerta {
  if (!(e instanceof ApiError)) {
    return { titulo: 'Sin conexión', texto: 'No se pudo conectar con el servidor. Verificá que el backend esté levantado.' };
  }
  // prestamo_controller: SocioSancionado -> 403, LimitePrestamosExcedido -> 409
  if (e.status === 403) return { titulo: 'Socio sancionado', texto: e.message };
  if (e.status === 409 && /l[ií]mite/i.test(e.message)) return { titulo: 'Límite de préstamos alcanzado', texto: e.message };
  if (e.status === 409) return { titulo: 'El ejemplar no se puede prestar', texto: e.message };
  return { titulo: 'No se pudo registrar el préstamo', texto: e.message };
}

const MAX_SUGERENCIAS = 8;

/**
 * F7.2 – Préstamo directo en el mostrador: un ejemplar DISPONIBLE de la sede para un socio.
 * Antes de confirmar avisa si el socio tiene sanción vigente o llegó al límite; si el backend
 * igual rechaza (SocioSancionado, LimitePrestamosExcedido), muestra la alerta correspondiente.
 */
export default function PrestamoDirectoForm({ sedeId, sedeNombre, libros, ejemplares, onAviso, onCambio }: Props) {
  const [socio, setSocio] = useState<SocioElegido | null>(null);
  const [ejemplarId, setEjemplarId] = useState<number | null>(null);
  const [tipo, setTipo] = useState<PrestamoTipo>(PrestamoTipo.LOCAL);
  const [tipoTocado, setTipoTocado] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [errores, setErrores] = useState<{ socio?: string; ejemplar?: string }>({});
  const [alerta, setAlerta] = useState<Alerta | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [activandoSocio, setActivandoSocio] = useState(false);
  const [situacion, setSituacion] = useState<Situacion | null>(null);

  const disponibles = useMemo(
    () => ejemplares.filter((e) => e.estado === EjemplarEstado.DISPONIBLE && e.sede_actual_id === sedeId),
    [ejemplares, sedeId],
  );
  const ejemplar = disponibles.find((e) => e.id === ejemplarId) ?? null;

  // Si cambia la sede o el ejemplar dejó de estar disponible, se descarta la elección
  useEffect(() => {
    if (ejemplarId !== null && !ejemplar) setEjemplarId(null);
  }, [ejemplarId, ejemplar]);

  // Tipo sugerido: si el ejemplar es de otra sede (llegó por remito) es interbibliotecario
  useEffect(() => {
    if (ejemplar && !tipoTocado) {
      setTipo(ejemplar.sede_origen_id !== sedeId ? PrestamoTipo.INTERBIBLIOTECARIO : PrestamoTipo.LOCAL);
    }
  }, [ejemplar, sedeId, tipoTocado]);

  // Situación del socio: préstamos abiertos y sanciones vigentes
  const socioId = socio?.id ?? null;
  useEffect(() => {
    if (socioId === null) {
      setSituacion(null);
      return;
    }
    let vigente = true;
    setSituacion({ cargando: true, abiertos: [], sanciones: [], error: null });
    Promise.all([mostradorService.prestamosDeSocio(socioId), mostradorService.sancionesVigentes(socioId)])
      .then(([prestamos, sanciones]) => {
        if (!vigente) return;
        setSituacion({
          cargando: false,
          abiertos: prestamos.filter((p) => p.estado !== PrestamoEstado.FINALIZADO),
          sanciones,
          error: null,
        });
      })
      .catch(() => {
        if (vigente)
          setSituacion({
            cargando: false,
            abiertos: [],
            sanciones: [],
            error: 'No se pudo consultar la situación del socio; el backend la valida igual al confirmar.',
          });
      });
    return () => {
      vigente = false;
    };
  }, [socioId]);

  const sancionado = (situacion?.sanciones.length ?? 0) > 0;
  const enLimite = (situacion?.abiertos.length ?? 0) >= MAX_PRESTAMOS_ABIERTOS;
  // Atrasados: VENCIDO según el backend, o ACTIVO con la fecha ya pasada
  const vencidos =
    situacion?.abiertos.filter((p) => p.estado === PrestamoEstado.VENCIDO || diasHasta(p.fecha_vencimiento) < 0).length ?? 0;
  const estadoSocio = socio?.socio?.estado;
  const sinCuota = estadoSocio === 'PENDIENTE_CUOTA';
  const inactivo = !!estadoSocio && estadoSocio !== 'ACTIVO';
  const bloqueado = sancionado || enLimite || inactivo;

  const limpiar = () => {
    setEjemplarId(null);
    setObservaciones('');
    setTipoTocado(false);
    setAlerta(null);
    setErrores({});
  };

  const confirmarCuota = async () => {
    if (!socio) return;
    setActivandoSocio(true);
    try {
      await mostradorService.activarSocio(socio.id);
      setSocio((prev) =>
        prev
          ? {
              ...prev,
              socio: prev.socio ? { ...prev.socio, estado: 'ACTIVO' } : undefined,
            }
          : null,
      );
      onAviso({
        tipo: 'ok',
        texto: `Cuota social registrada: ${socio.socio ? `${socio.socio.nombre} ${socio.socio.apellido}` : `N° ${socio.id}`} ya está habilitado como socio.`,
      });
      onCambio();
    } catch (err) {
      setAlerta(alertaDeError(err));
    } finally {
      setActivandoSocio(false);
    }
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const nuevos: typeof errores = {};
    if (!socio) nuevos.socio = 'Elegí el socio.';
    if (!ejemplar) nuevos.ejemplar = 'Elegí un ejemplar disponible.';
    setErrores(nuevos);
    if (!socio || !ejemplar) return;

    setGuardando(true);
    setAlerta(null);
    try {
      const prestamo = await mostradorService.crearPrestamo({
        socio_id: socio.id,
        ejemplar_id: ejemplar.id,
        tipo,
        observaciones: observaciones.trim() || null,
      });
      onAviso({
        tipo: 'ok',
        texto: `Préstamo ${prestamo.numero} registrado: "${ejemplar.libro.nombre}" (${ejemplar.codigo_inventario}) vence el ${formatearFecha(prestamo.fecha_vencimiento)}.`,
      });
      limpiar();
      setSocio(null);
      onCambio();
    } catch (err) {
      setAlerta(alertaDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="ejemplar-form mos-form" onSubmit={guardar} noValidate>
      <div className="mos-form-grid">
        {/* --- Columna izquierda: socio y su situación --- */}
        <div className="mos-form-col">
          <div className="campo">
            <span>Socio *</span>
            <SocioSelector
              value={socio}
              onChange={(s) => {
                setSocio(s);
                setAlerta(null);
                setErrores((x) => ({ ...x, socio: undefined }));
              }}
              invalido={!!errores.socio}
            />
            {errores.socio && <small className="campo-error">{errores.socio}</small>}
          </div>

          {situacion && (
            <div className="mos-situacion" aria-live="polite">
              {situacion.cargando ? (
                <small className="muted">Consultando préstamos y sanciones del socio…</small>
              ) : situacion.error ? (
                <small className="muted">{situacion.error}</small>
              ) : (
                <>
                  <div className="mos-situacion-datos">
                    <div>
                      <span>Préstamos abiertos</span>
                      <strong className={enLimite ? 'mal' : ''}>
                        {situacion.abiertos.length} / {MAX_PRESTAMOS_ABIERTOS}
                      </strong>
                    </div>
                    <div>
                      <span>Vencidos</span>
                      <strong className={vencidos ? 'mal' : ''}>{vencidos}</strong>
                    </div>
                    <div>
                      <span>Sanciones vigentes</span>
                      <strong className={sancionado ? 'mal' : ''}>{situacion.sanciones.length}</strong>
                    </div>
                  </div>

                  {sinCuota && (
                    <div className="mos-alerta aviso" role="alert">
                      <strong>Aún no es socio: debe abonar la cuota social</strong>
                      <span>
                        Esta persona creó su cuenta web pero todavía no pagó la cuota de ingreso para habilitarse como socio.
                      </span>
                      <button
                        type="button"
                        className="inv-accion ok"
                        style={{ justifySelf: 'start', marginTop: 6 }}
                        disabled={activandoSocio}
                        onClick={() => void confirmarCuota()}
                      >
                        {activandoSocio ? 'Registrando pago…' : 'Registrar pago de cuota y habilitar'}
                      </button>
                    </div>
                  )}
                  {!sinCuota && inactivo && (
                    <div className="mos-alerta error" role="alert">
                      <strong>Socio no habilitado ({estadoSocio})</strong>
                      <span>No puede retirar libros mientras su cuenta esté en estado {estadoSocio}.</span>
                    </div>
                  )}

                  {sancionado && (
                    <div className="mos-alerta error" role="alert">
                      <strong>Socio bloqueado: tiene una sanción vigente</strong>
                      {situacion.sanciones.map((s) => (
                        <span key={s.id}>
                          {s.tipo}
                          {s.monto != null ? ` de $${s.monto.toLocaleString('es-AR')}` : ''}
                          {s.dias_suspension ? ` (${s.dias_suspension} días)` : ''} · {s.motivo}
                          {s.fecha_fin ? ` · hasta el ${formatearFecha(s.fecha_fin)}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  {!sancionado && enLimite && (
                    <div className="mos-alerta error" role="alert">
                      <strong>Alcanzó el límite de {MAX_PRESTAMOS_ABIERTOS} préstamos abiertos</strong>
                      <span>Tiene que devolver un libro antes de llevarse otro.</span>
                    </div>
                  )}
                  {!bloqueado && vencidos > 0 && (
                    <div className="mos-alerta aviso">
                      <strong>Tiene préstamos vencidos</strong>
                      <span>Al devolverlos se le va a aplicar la sanción por retraso.</span>
                    </div>
                  )}
                  {!bloqueado && vencidos === 0 && (
                    <div className="mos-alerta ok">
                      <strong>Habilitado para pedir prestado</strong>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* --- Columna derecha: ejemplar y tipo --- */}
        <div className="mos-form-col">
          <div className="campo">
            <span>Ejemplar disponible en {sedeNombre} *</span>
            <EjemplarSelector
              ejemplares={disponibles}
              libros={libros}
              value={ejemplarId}
              onChange={(id) => {
                setEjemplarId(id);
                setAlerta(null);
                setErrores((x) => ({ ...x, ejemplar: undefined }));
              }}
              invalido={!!errores.ejemplar}
            />
            {errores.ejemplar && <small className="campo-error">{errores.ejemplar}</small>}
            {!disponibles.length && (
              <small className="campo-ayuda">No hay ejemplares disponibles en esta sede ahora mismo.</small>
            )}
          </div>

          <div className="campo">
            <span>Tipo de préstamo</span>
            <div className="pickup-options mos-tipos">
              {[PrestamoTipo.LOCAL, PrestamoTipo.INTERBIBLIOTECARIO].map((t) => (
                <label key={t} className={tipo === t ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="tipo-prestamo"
                    checked={tipo === t}
                    onChange={() => {
                      setTipo(t);
                      setTipoTocado(true);
                    }}
                  />
                  <span className="radio-mark" />
                  <div>
                    <strong>{ETIQUETA_TIPO_PRESTAMO[t]}</strong>
                    <small className="available-now">
                      {t === PrestamoTipo.LOCAL ? 'El ejemplar es de esta sede' : 'El ejemplar vino de otra sede'}
                    </small>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <label className="campo">
            <span>Observaciones</span>
            <input
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej. Se entrega con la tapa algo gastada"
            />
          </label>
        </div>
      </div>

      {socio && ejemplar && (
        <p className="ejemplar-resumen">
          Se presta <b>{ejemplar.libro.nombre}</b> ({ejemplar.codigo_inventario}) a{' '}
          <b>{socio.socio ? `${socio.socio.nombre} ${socio.socio.apellido}` : `socio N° ${socio.id}`}</b> como
          préstamo <b>{ETIQUETA_TIPO_PRESTAMO[tipo].toLowerCase()}</b>. El vencimiento lo calcula el sistema.
        </p>
      )}

      {alerta && (
        <div className="mos-alerta error" role="alert">
          <strong>{alerta.titulo}</strong>
          <span>{alerta.texto}</span>
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="ghost-btn" onClick={() => { limpiar(); setSocio(null); }} disabled={guardando}>
          Limpiar
        </button>
        <button type="submit" className="confirm-reservation" disabled={guardando || bloqueado || !!situacion?.cargando}>
          {guardando ? 'REGISTRANDO…' : bloqueado ? 'SOCIO NO HABILITADO' : 'REGISTRAR PRÉSTAMO'}
        </button>
      </div>
    </form>
  );
}

/** Combobox de ejemplares DISPONIBLES de la sede: busca por código, signatura, título o autor. */
function EjemplarSelector({
  ejemplares,
  libros,
  value,
  onChange,
  invalido,
}: {
  ejemplares: EjemplarInventario[];
  libros: LibroListado[];
  value: number | null;
  onChange: (id: number | null) => void;
  invalido: boolean;
}) {
  const listaId = useId();
  const elegido = ejemplares.find((e) => e.id === value) ?? null;
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);

  const autores = useMemo(
    () => new Map(libros.map((l) => [l.id, l.autores.map((a) => a.nombre).join(', ')])),
    [libros],
  );

  const sugerencias = useMemo(() => {
    const q = normalizar(texto);
    const filtrados = q
      ? ejemplares.filter(
          (e) =>
            normalizar(e.codigo_inventario).includes(q) ||
            normalizar(e.signatura_topografica).includes(q) ||
            normalizar(e.libro.nombre).includes(q) ||
            normalizar(autores.get(e.libro_id)).includes(q),
        )
      : ejemplares;
    return filtrados.slice(0, MAX_SUGERENCIAS);
  }, [ejemplares, texto, autores]);

  const elegir = (e: EjemplarInventario) => {
    onChange(e.id);
    setTexto('');
    setAbierto(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAbierto(true);
      setActivo((i) => Math.min(i + 1, sugerencias.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && abierto && sugerencias[activo]) {
      e.preventDefault();
      elegir(sugerencias[activo]);
    } else if (e.key === 'Escape' && abierto) {
      e.stopPropagation();
      setAbierto(false);
    }
  };

  return (
    <div className={`libro-selector${invalido ? ' invalido' : ''}`}>
      <label className="admin-search">
        <AdminIcon name="ejemplares" size={17} />
        <input
          role="combobox"
          aria-label="Ejemplar a prestar"
          aria-expanded={abierto}
          aria-controls={listaId}
          aria-autocomplete="list"
          value={abierto || !elegido ? texto : `${elegido.codigo_inventario} · ${elegido.libro.nombre}`}
          placeholder="Código de inventario, título o autor"
          onChange={(e) => {
            setTexto(e.target.value);
            setActivo(0);
            setAbierto(true);
          }}
          onFocus={() => {
            setTexto('');
            setAbierto(true);
          }}
          onBlur={() => setAbierto(false)}
          onKeyDown={onKeyDown}
          disabled={!ejemplares.length}
        />
        {elegido && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(null)}
            aria-label="Quitar ejemplar elegido"
          >
            <AdminIcon name="close" size={15} />
          </button>
        )}
      </label>
      {abierto && (
        <ul className="libro-selector-lista" id={listaId} role="listbox">
          {sugerencias.length === 0 ? (
            <li className="vacio">No hay ejemplares disponibles que coincidan</li>
          ) : (
            sugerencias.map((e, i) => (
              <li
                key={e.id}
                role="option"
                aria-selected={i === activo}
                className={i === activo ? 'activo' : ''}
                onMouseDown={(ev) => ev.preventDefault()}
                onMouseEnter={() => setActivo(i)}
                onClick={() => elegir(e)}
              >
                <strong>{e.libro.nombre}</strong>
                <small>
                  <span className="mono">{e.codigo_inventario}</span>
                  {e.signatura_topografica ? ` · ${e.signatura_topografica}` : ''}
                  {autores.get(e.libro_id) ? ` · ${autores.get(e.libro_id)}` : ''}
                  {e.sede_origen_id !== e.sede_actual_id ? ` · de ${e.sede_origen.nombre}` : ''}
                </small>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}