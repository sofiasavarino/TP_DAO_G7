// import { useCallback, useEffect, useMemo, useState } from 'react';
// import { ENDPOINTS_PENDIENTES, esEndpointFaltante, mostradorService } from '../../services/mostradorService';
// import { sociosService } from '../../services/sociosService';
// import type { EjemplarInventario } from '../../types/ejemplares';
// import { PrestamoTipo } from '../../types/enums';
// import type { LibroListado } from '../../types/libros';
// import type { ReservaListaRetiro } from '../../types/mostrador';
// import type { Socio } from '../../types/socios';
// import { addDays, diasHasta, formatearFecha, textoVencimiento } from '../../utils/fechas';
// import { normalizar } from '../../utils/texto';
// import AdminIcon from '../admin/AdminIcon';
// import { mensajeDeError, type Aviso } from './avisos';
// import EndpointPendiente from './EndpointPendiente';

// interface Props {
//   sedeId: number;
//   usuarioId: number;
//   libros: LibroListado[];
//   ejemplares: EjemplarInventario[];
//   /** Cambia cuando otra parte del mostrador modificó datos (para recargar). */
//   version: number;
//   onAviso: (aviso: Aviso) => void;
//   onCambio: () => void;
//   onConteo: (n: number | null) => void;
// }

// /** Datos de la reserva completados con catálogo, inventario y padrón de socios. */
// interface ReservaVista extends ReservaListaRetiro {
//   libro?: LibroListado;
//   ejemplar?: EjemplarInventario;
//   socio?: Socio;
//   socioTexto: string;
//   libroTexto: string;
//   codigoTexto: string;
// }

// /**
//  * F7.1 – Bandeja de reservas LISTA_PARA_RETIRO de la sede del mostrador.
//  * "Entregar libro" cierra la reserva (CUMPLIDA) y crea el préstamo.
//  */
// export default function ReservasListasPanel({
//   sedeId,
//   usuarioId,
//   libros,
//   ejemplares,
//   version,
//   onAviso,
//   onCambio,
//   onConteo,
// }: Props) {
//   const [reservas, setReservas] = useState<ReservaListaRetiro[]>([]);
//   const [socios, setSocios] = useState<Socio[]>([]);
//   const [cargando, setCargando] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [faltaEndpoint, setFaltaEndpoint] = useState(false);
//   const [busqueda, setBusqueda] = useState('');
//   const [aEntregar, setAEntregar] = useState<ReservaVista | null>(null);

//   const cargar = useCallback(async () => {
//     setCargando(true);
//     setError(null);
//     setFaltaEndpoint(false);
//     try {
//       const [lista, listaSocios] = await Promise.all([
//         mostradorService.reservasListas(sedeId),
//         sociosService.listar().catch(() => [] as Socio[]),
//       ]);
//       // Primero las más urgentes (vencen antes); las de plazo ya vencido van al final
//       const clave = (r: ReservaListaRetiro) => {
//         const f = r.fecha_vencimiento_retiro;
//         return f === null ? '2' : diasHasta(f) < 0 ? `3${f}` : `1${f}`;
//       };
//       lista.sort((a, b) => clave(a).localeCompare(clave(b)));
//       setReservas(lista);
//       setSocios(listaSocios);
//       onConteo(lista.length);
//     } catch (e) {
//       onConteo(null);
//       if (esEndpointFaltante(e)) setFaltaEndpoint(true);
//       else setError(mensajeDeError(e, 'No se pudieron cargar las reservas.'));
//     } finally {
//       setCargando(false);
//     }
//   }, [sedeId, onConteo]);

//   useEffect(() => {
//     void cargar();
//   }, [cargar, version]);

//   const vistas: ReservaVista[] = useMemo(
//     () =>
//       reservas.map((r) => {
//         const libro = libros.find((l) => l.id === r.libro_id);
//         const ejemplar = ejemplares.find((e) => e.id === r.ejemplar_id);
//         const socio = socios.find((s) => s.id === r.socio_id);
//         const nombreCompleto = socio ? `${socio.nombre} ${socio.apellido}` : null;
//         return {
//           ...r,
//           libro,
//           ejemplar,
//           socio,
//           socioTexto: r.socio_nombre ?? nombreCompleto ?? `Socio N° ${r.socio_id}`,
//           libroTexto: r.libro_nombre ?? libro?.nombre ?? ejemplar?.libro.nombre ?? `Libro #${r.libro_id}`,
//           codigoTexto: r.ejemplar_codigo ?? ejemplar?.codigo_inventario ?? (r.ejemplar_id ? `#${r.ejemplar_id}` : '—'),
//         };
//       }),
//     [reservas, libros, ejemplares, socios],
//   );

//   const filtradas = useMemo(() => {
//     const q = normalizar(busqueda);
//     if (!q) return vistas;
//     return vistas.filter(
//       (r) =>
//         normalizar(r.socioTexto).includes(q) ||
//         normalizar(r.socio_dni ?? r.socio?.dni).includes(q) ||
//         String(r.socio_id) === q ||
//         normalizar(r.libroTexto).includes(q) ||
//         normalizar(r.codigoTexto).includes(q),
//     );
//   }, [vistas, busqueda]);

//   const alEntregar = (reservaId: number, texto: string) => {
//     setAEntregar(null);
//     const restantes = reservas.filter((r) => r.id !== reservaId);
//     setReservas(restantes);
//     onConteo(restantes.length);
//     onAviso({ tipo: 'ok', texto });
//     onCambio();
//   };

//   if (faltaEndpoint) {
//     return (
//       <EndpointPendiente
//         titulo="Bandeja de retiros sin conectar"
//         endpoint={`GET ${ENDPOINTS_PENDIENTES.reservasListas}?sede_id=${sedeId}`}
//         descripcion="El backend todavía no expone las reservas LISTA_PARA_RETIRO de una sede. Apenas se agregue ese endpoint, esta bandeja se llena sola."
//       />
//     );
//   }

//   return (
//     <>
//       <div className="inv-filtros">
//         <label className="admin-search">
//           <AdminIcon name="search" size={17} />
//           <input
//             value={busqueda}
//             onChange={(e) => setBusqueda(e.target.value)}
//             placeholder="Buscar por socio, DNI, libro o código"
//             aria-label="Buscar reserva"
//           />
//         </label>
//       </div>

//       {error ? (
//         <div className="admin-empty">
//           <h3>No pudimos cargar las reservas</h3>
//           <p>{error}</p>
//           <button className="ghost-btn" onClick={() => void cargar()}>
//             Reintentar
//           </button>
//         </div>
//       ) : cargando ? (
//         <div className="admin-table-wrap">
//           <div className="admin-skeleton" aria-hidden="true">
//             {Array.from({ length: 3 }, (_, i) => (
//               <span key={i} />
//             ))}
//           </div>
//         </div>
//       ) : filtradas.length === 0 ? (
//         <div className="admin-empty">
//           <h3>{reservas.length ? 'Sin resultados' : 'No hay retiros pendientes'}</h3>
//           <p>
//             {reservas.length
//               ? 'Ninguna reserva coincide con la búsqueda.'
//               : 'Cuando un ejemplar reservado quede listo en esta sede, va a aparecer acá.'}
//           </p>
//         </div>
//       ) : (
//         <ul className="mos-reservas">
//           {filtradas.map((r) => {
//             const dias = r.fecha_vencimiento_retiro ? diasHasta(r.fecha_vencimiento_retiro) : null;
//             const urgencia = dias === null ? '' : dias < 0 ? 'vencida' : dias === 0 ? 'hoy' : '';
//             const dni = r.socio_dni ?? r.socio?.dni;
//             return (
//               <li key={r.id} className={urgencia ? `urgente-${urgencia}` : ''}>
//                 {r.libro?.imagen_url ? (
//                   <img src={r.libro.imagen_url} alt="" />
//                 ) : (
//                   <span className="admin-cover-vacia" aria-hidden="true">
//                     {r.libroTexto.charAt(0)}
//                   </span>
//                 )}
//                 <div className="mos-reserva-info">
//                   <strong>{r.libroTexto}</strong>
//                   <span>
//                     <AdminIcon name="socios" size={14} /> {r.socioTexto}
//                     {dni && <small> · DNI {dni}</small>}
//                   </span>
//                   <small>
//                     Ejemplar <b className="mono">{r.codigoTexto}</b> · Reservado el {formatearFecha(r.fecha_reserva)}
//                   </small>
//                 </div>
//                 <div className="mos-reserva-plazo">
//                   {r.fecha_vencimiento_retiro ? (
//                     <>
//                       <span className={`mos-plazo ${urgencia}`}>
//                         {dias !== null && dias < 0 ? 'Plazo vencido' : textoVencimiento(r.fecha_vencimiento_retiro, 'Retira')}
//                       </span>
//                       <small>hasta el {formatearFecha(r.fecha_vencimiento_retiro)}</small>
//                     </>
//                   ) : (
//                     <small className="muted">Sin plazo cargado</small>
//                   )}
//                 </div>
//                 {dias !== null && dias < 0 ? (
//                   <small className="muted mos-sin-accion">Se libera al procesar los vencimientos</small>
//                 ) : (
//                   <button className="admin-primary" onClick={() => setAEntregar(r)}>
//                     <AdminIcon name="check" size={17} />
//                     Entregar libro
//                   </button>
//                 )}
//               </li>
//             );
//           })}
//         </ul>
//       )}

//       {aEntregar && (
//         <EntregaModal
//           reserva={aEntregar}
//           sedeId={sedeId}
//           usuarioId={usuarioId}
//           onCerrar={() => setAEntregar(null)}
//           onEntregada={alEntregar}
//         />
//       )}
//     </>
//   );
// }

// /** Confirmación de entrega con detalle del cliente y del préstamo. */
// function EntregaModal({
//   reserva,
//   sedeId,
//   usuarioId,
//   onCerrar,
//   onEntregada,
// }: {
//   reserva: ReservaVista;
//   sedeId: number;
//   usuarioId: number;
//   onCerrar: () => void;
//   onEntregada: (reservaId: number, aviso: string) => void;
// }) {
//   const tipo =
//     reserva.ejemplar && reserva.ejemplar.sede_origen_id !== sedeId
//       ? PrestamoTipo.INTERBIBLIOTECARIO
//       : PrestamoTipo.LOCAL;
//   const [guardando, setGuardando] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && !guardando && onCerrar();
//     window.addEventListener('keydown', onKey);
//     return () => window.removeEventListener('keydown', onKey);
//   }, [onCerrar, guardando]);

//   const confirmar = async () => {
//     setGuardando(true);
//     setError(null);
//     try {
//       const prestamo = await mostradorService.entregarReserva(reserva.id, sedeId, usuarioId, tipo);
//       onEntregada(
//         reserva.id,
//         `Se entregó "${reserva.libroTexto}" a ${reserva.socioTexto}. Préstamo ${prestamo.numero}, vence el ${formatearFecha(prestamo.fecha_vencimiento)}.`,
//       );
//     } catch (e) {
//       setError(mensajeDeError(e, 'No se pudo entregar el libro.'));
//       setGuardando(false);
//     }
//   };

//   const dni = reserva.socio_dni ?? reserva.socio?.dni;
//   const hoy = addDays(0);
//   const vencimientoEstimado = addDays(15);

//   const filaDato = (etiqueta: string, valor: string, mono = false) => (
//     <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5 }}>
//       <span className="muted">{etiqueta}</span>
//       <strong className={mono ? 'mono' : undefined} style={{ textAlign: 'right' }}>
//         {valor}
//       </strong>
//     </div>
//   );

//   return (
//     <div className="reservation-modal-backdrop" role="presentation">
//       <section className="reservation-modal" role="dialog" aria-modal="true" aria-labelledby="entrega-title">
//         <button className="modal-close" onClick={onCerrar} aria-label="Cerrar" disabled={guardando}>
//           <AdminIcon name="close" size={18} />
//         </button>
//         <span className="eyebrow">ENTREGA DE RESERVA</span>
//         <h2 id="entrega-title">Confirmar entrega</h2>

//         <div className="modal-book">
//           {reserva.libro?.imagen_url && <img src={reserva.libro.imagen_url} alt="" />}
//           <div>
//             <strong>{reserva.libroTexto}</strong>
//             <span>Ejemplar {reserva.codigoTexto}</span>
//           </div>
//         </div>

//         <div
//           style={{
//             display: 'grid',
//             gap: 10,
//             padding: '14px 16px',
//             border: '1px solid rgba(29, 36, 32, .14)',
//             background: '#fff',
//             marginTop: 14,
//           }}
//         >
//           <span
//             style={{
//               fontSize: 10.5,
//               fontWeight: 700,
//               letterSpacing: '0.14em',
//               textTransform: 'uppercase',
//               color: 'var(--rust)',
//             }}
//           >
//             Datos del cliente
//           </span>
//           {filaDato('Socio', reserva.socioTexto)}
//           {filaDato('N° de socio', `#${reserva.socio_id}`, true)}
//           {dni && filaDato('DNI', dni, true)}
//           {reserva.socio?.telefono && filaDato('Teléfono', reserva.socio.telefono)}
//         </div>

//         <div
//           style={{
//             display: 'grid',
//             gap: 10,
//             padding: '14px 16px',
//             border: '1px solid rgba(29, 36, 32, .14)',
//             background: '#fff',
//             marginTop: 12,
//           }}
//         >
//           <span
//             style={{
//               fontSize: 10.5,
//               fontWeight: 700,
//               letterSpacing: '0.14em',
//               textTransform: 'uppercase',
//               color: 'var(--rust)',
//             }}
//           >
//             Datos del préstamo
//           </span>
//           {filaDato('Ejemplar', reserva.codigoTexto, true)}
//           {filaDato('Reservado el', formatearFecha(reserva.fecha_reserva))}
//           {filaDato('Fecha de retiro', formatearFecha(hoy))}
//           {filaDato('Devolución estimada (15 días)', formatearFecha(vencimientoEstimado))}
//         </div>

//         {error && (
//           <div className="login-error" role="alert" style={{ marginTop: 14 }}>
//             {error}
//           </div>
//         )}

//         <div
//           style={{
//             display: 'flex',
//             flexDirection: 'column',
//             gap: 10,
//             marginTop: 20,
//           }}
//         >
//           <button
//             type="button"
//             className="confirm-reservation"
//             onClick={() => void confirmar()}
//             disabled={guardando}
//             style={{ width: '100%', marginTop: 0, borderRadius: 0 }}
//           >
//             {guardando ? 'ENTREGANDO…' : 'CONFIRMAR ENTREGA'}
//           </button>
//           <button
//             type="button"
//             onClick={onCerrar}
//             disabled={guardando}
//             style={{
//               width: '100%',
//               padding: '14px 18px',
//               fontFamily: 'inherit',
//               fontSize: 13,
//               fontWeight: 700,
//               borderRadius: 0,
//               background: '#e5e2dc',
//               color: '#3d433f',
//               border: '1px solid #c9c4ba',
//               cursor: 'pointer',
//             }}
//           >
//             Cancelar
//           </button>
//         </div>
//       </section>
//     </div>
//   );
// }
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ENDPOINTS_PENDIENTES, esEndpointFaltante, mostradorService } from '../../services/mostradorService';
import { sociosService } from '../../services/sociosService';
import type { EjemplarInventario } from '../../types/ejemplares';
import { PrestamoTipo, SocioEstado } from '../../types/enums';
import type { LibroListado } from '../../types/libros';
import { ETIQUETA_TIPO_PRESTAMO, type ReservaListaRetiro } from '../../types/mostrador';
import type { Socio } from '../../types/socios';
import { diasHasta, formatearFecha, textoVencimiento } from '../../utils/fechas';
import { normalizar } from '../../utils/texto';
import AdminIcon from '../admin/AdminIcon';
import { mensajeDeError, type Aviso } from './avisos';
import EndpointPendiente from './EndpointPendiente';

interface Props {
  sedeId: number;
  usuarioId: number;
  libros: LibroListado[];
  ejemplares: EjemplarInventario[];
  /** Cambia cuando otra parte del mostrador modificó datos (para recargar). */
  version: number;
  onAviso: (aviso: Aviso) => void;
  onCambio: () => void;
  onConteo: (n: number | null) => void;
}

/** Datos de la reserva completados con catálogo e inventario si el backend no los manda. */
interface ReservaVista extends ReservaListaRetiro {
  libro?: LibroListado;
  ejemplar?: EjemplarInventario;
  socio?: Socio;
  socioTexto: string;
  libroTexto: string;
  codigoTexto: string;
}

/**
 * F7.1 – Bandeja de reservas LISTA_PARA_RETIRO de la sede del mostrador.
 * "Entregar libro" cierra la reserva (CUMPLIDA) y crea el préstamo.
 */
export default function ReservasListasPanel({
  sedeId,
  usuarioId,
  libros,
  ejemplares,
  version,
  onAviso,
  onCambio,
  onConteo,
}: Props) {
  const [reservas, setReservas] = useState<ReservaListaRetiro[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faltaEndpoint, setFaltaEndpoint] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [aEntregar, setAEntregar] = useState<ReservaVista | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    setFaltaEndpoint(false);
    try {
      const [lista, listaSocios] = await Promise.all([
        mostradorService.reservasListas(sedeId),
        sociosService.listar().catch(() => [] as Socio[]),
      ]);
      // Primero las más urgentes (vencen antes); las de plazo ya vencido van al final
      const clave = (r: ReservaListaRetiro) => {
        const f = r.fecha_vencimiento_retiro;
        return f === null ? '2' : diasHasta(f) < 0 ? `3${f}` : `1${f}`;
      };
      lista.sort((a, b) => clave(a).localeCompare(clave(b)));
      setReservas(lista);
      setSocios(listaSocios);
      onConteo(lista.length);
    } catch (e) {
      onConteo(null);
      if (esEndpointFaltante(e)) setFaltaEndpoint(true);
      else setError(mensajeDeError(e, 'No se pudieron cargar las reservas.'));
    } finally {
      setCargando(false);
    }
  }, [sedeId, onConteo]);

  useEffect(() => {
    void cargar();
  }, [cargar, version]);

  const vistas: ReservaVista[] = useMemo(
    () =>
      reservas.map((r) => {
        const libro = libros.find((l) => l.id === r.libro_id);
        const ejemplar = ejemplares.find((e) => e.id === r.ejemplar_id);
        const socio = socios.find((s) => s.id === r.socio_id);
        return {
          ...r,
          libro,
          ejemplar,
          socio,
          socioTexto: r.socio_nombre ?? (socio ? `${socio.nombre} ${socio.apellido}` : `Socio N° ${r.socio_id}`),
          libroTexto: r.libro_nombre ?? libro?.nombre ?? ejemplar?.libro.nombre ?? `Libro #${r.libro_id}`,
          codigoTexto: r.ejemplar_codigo ?? ejemplar?.codigo_inventario ?? (r.ejemplar_id ? `#${r.ejemplar_id}` : '—'),
        };
      }),
    [reservas, libros, ejemplares, socios],
  );

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return vistas;
    return vistas.filter(
      (r) =>
        normalizar(r.socioTexto).includes(q) ||
        normalizar(r.socio_dni ?? r.socio?.dni).includes(q) ||
        String(r.socio_id) === q ||
        normalizar(r.libroTexto).includes(q) ||
        normalizar(r.codigoTexto).includes(q),
    );
  }, [vistas, busqueda]);

  const alEntregar = (reservaId: number, texto: string) => {
    setAEntregar(null);
    const restantes = reservas.filter((r) => r.id !== reservaId);
    setReservas(restantes);
    onConteo(restantes.length);
    onAviso({ tipo: 'ok', texto });
    onCambio();
  };

  if (faltaEndpoint) {
    return (
      <EndpointPendiente
        titulo="Bandeja de retiros sin conectar"
        endpoint={`GET ${ENDPOINTS_PENDIENTES.reservasListas}?sede_id=${sedeId}`}
        descripcion="El backend todavía no expone las reservas LISTA_PARA_RETIRO de una sede. Apenas se agregue ese endpoint, esta bandeja se llena sola."
      />
    );
  }

  return (
    <>
      <div className="inv-filtros">
        <label className="admin-search">
          <AdminIcon name="search" size={17} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por socio, DNI, libro o código"
            aria-label="Buscar reserva"
          />
        </label>
      </div>

      {error ? (
        <div className="admin-empty">
          <h3>No pudimos cargar las reservas</h3>
          <p>{error}</p>
          <button className="ghost-btn" onClick={() => void cargar()}>
            Reintentar
          </button>
        </div>
      ) : cargando ? (
        <div className="admin-table-wrap">
          <div className="admin-skeleton" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="admin-empty">
          <h3>{reservas.length ? 'Sin resultados' : 'No hay retiros pendientes'}</h3>
          <p>
            {reservas.length
              ? 'Ninguna reserva coincide con la búsqueda.'
              : 'Cuando un ejemplar reservado quede listo en esta sede, va a aparecer acá.'}
          </p>
        </div>
      ) : (
        <ul className="mos-reservas">
          {filtradas.map((r) => {
            const dias = r.fecha_vencimiento_retiro ? diasHasta(r.fecha_vencimiento_retiro) : null;
            const urgencia = dias === null ? '' : dias < 0 ? 'vencida' : dias === 0 ? 'hoy' : '';
            const dni = r.socio_dni ?? r.socio?.dni;
            const sinCuota = r.socio?.estado === SocioEstado.PENDIENTE_CUOTA;
            return (
              <li key={r.id} className={urgencia ? `urgente-${urgencia}` : ''}>
                {r.libro?.imagen_url ? (
                  <img src={r.libro.imagen_url} alt="" />
                ) : (
                  <span className="admin-cover-vacia" aria-hidden="true">
                    {r.libroTexto.charAt(0)}
                  </span>
                )}
                <div className="mos-reserva-info">
                  <strong>{r.libroTexto}</strong>
                  <span>
                    <AdminIcon name="socios" size={14} /> {r.socioTexto}
                    {dni && <small> · DNI {dni}</small>}
                    {sinCuota && (
                      <span className="mos-plazo hoy" style={{ marginLeft: 6 }}>
                        Pendiente de cuota social
                      </span>
                    )}
                  </span>
                  <small>
                    Ejemplar <b className="mono">{r.codigoTexto}</b> · Reservado el {formatearFecha(r.fecha_reserva)}
                  </small>
                </div>
                <div className="mos-reserva-plazo">
                  {r.fecha_vencimiento_retiro ? (
                    <>
                      <span className={`mos-plazo ${urgencia}`}>
                        {dias !== null && dias < 0 ? 'Plazo vencido' : textoVencimiento(r.fecha_vencimiento_retiro, 'Retira')}
                      </span>
                      <small>hasta el {formatearFecha(r.fecha_vencimiento_retiro)}</small>
                    </>
                  ) : (
                    <small className="muted">Sin plazo cargado</small>
                  )}
                </div>
                {dias !== null && dias < 0 ? (
                  <small className="muted mos-sin-accion">Se libera al procesar los vencimientos</small>
                ) : (
                  <button className="admin-primary" onClick={() => setAEntregar(r)}>
                    <AdminIcon name="check" size={17} />
                    Entregar libro
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {aEntregar && (
        <EntregaModal
          reserva={aEntregar}
          sedeId={sedeId}
          usuarioId={usuarioId}
          onCerrar={() => setAEntregar(null)}
          onEntregada={alEntregar}
          onCuotaActivada={(socioId) => {
            setSocios((prev) =>
              prev.map((s) => (s.id === socioId ? { ...s, estado: SocioEstado.ACTIVO } : s)),
            );
            onAviso({
              tipo: 'ok',
              texto: `Cuota social registrada: ${aEntregar.socioTexto} ya está habilitado como socio.`,
            });
            onCambio();
          }}
        />
      )}
    </>
  );
}

/** Confirmación de la entrega: elige el tipo de préstamo que nace del retiro. */
function EntregaModal({
  reserva,
  sedeId,
  usuarioId,
  onCerrar,
  onEntregada,
  onCuotaActivada,
}: {
  reserva: ReservaVista;
  sedeId: number;
  usuarioId: number;
  onCerrar: () => void;
  onEntregada: (reservaId: number, aviso: string) => void;
  onCuotaActivada: (socioId: number) => void;
}) {
  // Si el ejemplar es de otra sede (llegó por remito) el préstamo es interbibliotecario
  const sugerido =
    reserva.ejemplar && reserva.ejemplar.sede_origen_id !== sedeId ? PrestamoTipo.INTERBIBLIOTECARIO : PrestamoTipo.LOCAL;
  const [tipo, setTipo] = useState<PrestamoTipo>(sugerido);
  const [habilitadoLocal, setHabilitadoLocal] = useState(
    reserva.socio?.estado !== SocioEstado.PENDIENTE_CUOTA,
  );
  const [activandoCuota, setActivandoCuota] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && !guardando && !activandoCuota && onCerrar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar, guardando, activandoCuota]);

  const cobrarCuota = async () => {
    setActivandoCuota(true);
    setError(null);
    try {
      await mostradorService.activarSocio(reserva.socio_id);
      setHabilitadoLocal(true);
      onCuotaActivada(reserva.socio_id);
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo registrar el pago de la cuota.'));
    } finally {
      setActivandoCuota(false);
    }
  };

  const confirmar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const prestamo = await mostradorService.entregarReserva(reserva.id, sedeId, usuarioId, tipo);
      onEntregada(
        reserva.id,
        `Se entregó "${reserva.libroTexto}" a ${reserva.socioTexto}. Préstamo ${prestamo.numero}, vence el ${formatearFecha(prestamo.fecha_vencimiento)}.`,
      );
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo entregar el libro.'));
      setGuardando(false);
    }
  };

  return (
    <div className="reservation-modal-backdrop" role="presentation">
      <section className="reservation-modal" role="dialog" aria-modal="true" aria-labelledby="entrega-title">
        <button className="modal-close" onClick={onCerrar} aria-label="Cerrar" disabled={guardando || activandoCuota}>
          <AdminIcon name="close" size={18} />
        </button>
        <span className="eyebrow">ENTREGA DE RESERVA</span>
        <h2 id="entrega-title">¿Entregar el libro?</h2>
        <div className="modal-book">
          {reserva.libro?.imagen_url && <img src={reserva.libro.imagen_url} alt="" />}
          <div>
            <strong>{reserva.libroTexto}</strong>
            <span>
              {reserva.socioTexto} · Ejemplar {reserva.codigoTexto}
            </span>
          </div>
        </div>

        {!habilitadoLocal && (
          <div className="mos-alerta aviso" role="alert" style={{ marginBottom: 14 }}>
            <strong>Aún no es socio: debe abonar la cuota social</strong>
            <span>
              Esta persona se registró por la web pero todavía no pagó la cuota de ingreso. Cobrala antes de entregar el libro.
            </span>
            <button
              type="button"
              className="inv-accion ok"
              style={{ justifySelf: 'start', marginTop: 6 }}
              disabled={activandoCuota}
              onClick={() => void cobrarCuota()}
            >
              {activandoCuota ? 'Registrando pago…' : 'Registrar pago de cuota y habilitar'}
            </button>
          </div>
        )}

        <p className="campo-ayuda mos-modal-label">Tipo de préstamo</p>
        <div className="pickup-options">
          {[PrestamoTipo.LOCAL, PrestamoTipo.INTERBIBLIOTECARIO].map((t) => (
            <label key={t} className={tipo === t ? 'selected' : ''}>
              <input type="radio" name="tipo-entrega" checked={tipo === t} onChange={() => setTipo(t)} />
              <span className="radio-mark" />
              <div>
                <strong>{ETIQUETA_TIPO_PRESTAMO[t]}</strong>
                <small className={t === sugerido ? 'available-now' : ''}>
                  {t === PrestamoTipo.LOCAL ? 'El ejemplar es de esta sede' : 'El ejemplar llegó de otra sede'}
                  {t === sugerido ? ' · sugerido' : ''}
                </small>
              </div>
            </label>
          ))}
        </div>

        <p className="ejemplar-resumen mos-resumen">
          La reserva queda <b>cumplida</b> y se crea el préstamo a nombre del socio.
        </p>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <div className="modal-actions">
          
          <button
            className="confirm-reservation"
            style={{ width: '100%', marginTop: 0, borderRadius: 0 }}
            onClick={() => void confirmar()}
            disabled={guardando || !habilitadoLocal}
          >
            {guardando ? 'ENTREGANDO…' : !habilitadoLocal ? 'COBRAR CUOTA PRIMERO' : 'CONFIRMAR ENTREGA'}
          </button>
          <button className="ghost-btn" style={{
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
                  }} onClick={onCerrar} disabled={guardando || activandoCuota}>
            Cancelar
          </button>
        </div>
      </section>
    </div>
  );
}