// import { useCallback, useEffect, useMemo, useState } from 'react';
// import AdminIcon from '../../components/admin/AdminIcon';
// import { mensajeDeError, type Aviso } from '../../components/mostrador/avisos';
// import SocioFichaModal, { estaAtrasado, type SocioVista } from '../../components/socios/SocioFichaModal';
// import { useAuth } from '../../context/AuthContext';
// import { sociosService } from '../../services/sociosService';
// import { PrestamoEstado, SocioEstado } from '../../types/enums';
// import type { PrestamoListado } from '../../types/mostrador';
// import { ETIQUETA_ESTADO_SOCIO, ETIQUETA_SANCION, type Sancion, type Socio } from '../../types/socios';
// import { normalizar } from '../../utils/texto';
// import './socios.css';

// const POR_PAGINA = 20;
// type Filtro = 'todos' | 'morosos' | SocioEstado;

// /**
//  * F8.3 / F8.4 – Padrón de socios con su estado, resaltando a quienes tienen préstamos
//  * vencidos (morosos). Desde la ficha de cada socio se aplican sanciones (MULTA o SUSPENSION)
//  * sobre un préstamo y se levantan las vigentes.
//  */
// export default function SociosPage() {
//   const { usuario } = useAuth();
//   const [socios, setSocios] = useState<Socio[]>([]);
//   const [prestamos, setPrestamos] = useState<PrestamoListado[]>([]);
//   const [sanciones, setSanciones] = useState<Sancion[]>([]);
//   const [cargando, setCargando] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [aviso, setAviso] = useState<Aviso | null>(null);
//   const [busqueda, setBusqueda] = useState('');
//   const [filtro, setFiltro] = useState<Filtro>('todos');
//   const [pagina, setPagina] = useState(1);
//   const [fichaId, setFichaId] = useState<number | null>(null);

//   const cargar = useCallback(async () => {
//     setCargando(true);
//     setError(null);
//     try {
//       const [s, p, sa] = await Promise.all([
//         sociosService.listar(),
//         sociosService.prestamos(),
//         sociosService.sancionesVigentes(),
//       ]);
//       setSocios(s);
//       setPrestamos(p);
//       setSanciones(sa);
//     } catch (e) {
//       setError(mensajeDeError(e, 'No se pudo cargar el padrón.'));
//     } finally {
//       setCargando(false);
//     }
//   }, []);

//   useEffect(() => {
//     void cargar();
//   }, [cargar]);

//   useEffect(() => {
//     if (!aviso) return;
//     const t = window.setTimeout(() => setAviso(null), 6000);
//     return () => window.clearTimeout(t);
//   }, [aviso]);

//   useEffect(() => setPagina(1), [busqueda, filtro]);

//   // Cruza cada socio con sus préstamos y sanciones vigentes
//   const vistas: SocioVista[] = useMemo(() => {
//     const prestamosDe = new Map<number, PrestamoListado[]>();
//     for (const p of prestamos) prestamosDe.set(p.socio_id, [...(prestamosDe.get(p.socio_id) ?? []), p]);
//     const sancionesDe = new Map<number, Sancion[]>();
//     for (const s of sanciones) sancionesDe.set(s.socio_id, [...(sancionesDe.get(s.socio_id) ?? []), s]);
//     return socios.map((s) => {
//       const suyos = prestamosDe.get(s.id) ?? [];
//       return {
//         ...s,
//         prestamos: suyos,
//         abiertos: suyos.filter((p) => p.estado !== PrestamoEstado.FINALIZADO).length,
//         vencidos: suyos.filter(estaAtrasado),
//         sanciones: sancionesDe.get(s.id) ?? [],
//       };
//     });
//   }, [socios, prestamos, sanciones]);

//   const conteo = useMemo(
//     () => ({
//       todos: vistas.length,
//       morosos: vistas.filter((s) => s.vencidos.length > 0).length,
//       [SocioEstado.ACTIVO]: vistas.filter((s) => s.estado === SocioEstado.ACTIVO).length,
//       [SocioEstado.SUSPENDIDO]: vistas.filter((s) => s.estado === SocioEstado.SUSPENDIDO).length,
//       [SocioEstado.BAJA]: vistas.filter((s) => s.estado === SocioEstado.BAJA).length,
//     }),
//     [vistas],
//   );

//   const filtrados = useMemo(() => {
//     const q = normalizar(busqueda);
//     return vistas
//       .filter(
//         (s) =>
//           (filtro === 'todos' || (filtro === 'morosos' ? s.vencidos.length > 0 : s.estado === filtro)) &&
//           (!q ||
//             normalizar(`${s.nombre} ${s.apellido}`).includes(q) ||
//             normalizar(`${s.apellido} ${s.nombre}`).includes(q) ||
//             s.dni.includes(q) ||
//             String(s.id) === q),
//       )
//       // Los morosos primero, después por apellido
//       .sort((a, b) => Number(b.vencidos.length > 0) - Number(a.vencidos.length > 0));
//   }, [vistas, filtro, busqueda]);

//   const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
//   const paginaActual = Math.min(pagina, totalPaginas);
//   const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
//   const ficha = vistas.find((s) => s.id === fichaId) ?? null;

//   const FILTROS: { id: Filtro; texto: string; clase: string }[] = [
//     { id: 'todos', texto: 'Todos', clase: '' },
//     { id: 'morosos', texto: 'Con préstamos vencidos', clase: 'est-moroso' },
//     { id: SocioEstado.ACTIVO, texto: 'Activos', clase: 'est-soc-activo' },
//     { id: SocioEstado.SUSPENDIDO, texto: 'Suspendidos', clase: 'est-soc-suspendido' },
//     { id: SocioEstado.BAJA, texto: 'Baja', clase: 'est-soc-baja' },
//   ];

//   return (
//     <section className="admin-page">
//       <div className="admin-page-head">
//         <div>
//           <span className="eyebrow">PADRÓN Y SANCIONES</span>
//           <h1>
//             <em>Socios</em>
//           </h1>
//           <p className="muted">
//             {cargando
//               ? 'Cargando…'
//               : `${conteo.todos} socios · ${conteo.morosos} con préstamos vencidos · ${sanciones.length} sanciones vigentes`}
//           </p>
//         </div>
//       </div>

//       {aviso && (
//         <div className={`admin-aviso ${aviso.tipo}`} role={aviso.tipo === 'error' ? 'alert' : 'status'}>
//           <AdminIcon name={aviso.tipo === 'ok' ? 'check' : 'close'} size={18} />
//           <span>{aviso.texto}</span>
//           <button onClick={() => setAviso(null)} aria-label="Cerrar aviso">
//             <AdminIcon name="close" size={15} />
//           </button>
//         </div>
//       )}

//       <div className="inv-filtros">
//         <label className="admin-search">
//           <AdminIcon name="search" size={17} />
//           <input
//             value={busqueda}
//             onChange={(e) => setBusqueda(e.target.value)}
//             placeholder="Nombre, apellido, DNI o N° de socio"
//             aria-label="Buscar socio"
//           />
//           {busqueda && (
//             <button onClick={() => setBusqueda('')} aria-label="Borrar búsqueda">
//               <AdminIcon name="close" size={15} />
//             </button>
//           )}
//         </label>
//       </div>

//       <div className="inv-estados" role="group" aria-label="Filtrar socios">
//         {FILTROS.map((f) => (
//           <button
//             key={f.id}
//             className={`${filtro === f.id ? 'activo ' : ''}${f.clase}`}
//             onClick={() => setFiltro(f.id)}
//             aria-pressed={filtro === f.id}
//           >
//             {f.clase && <i aria-hidden="true" />}
//             {f.texto} <b>{conteo[f.id]}</b>
//           </button>
//         ))}
//       </div>

//       {error ? (
//         <div className="admin-empty">
//           <h3>No pudimos cargar el padrón</h3>
//           <p>{error}</p>
//           <button className="ghost-btn" onClick={() => void cargar()}>
//             Reintentar
//           </button>
//         </div>
//       ) : cargando ? (
//         <div className="admin-table-wrap">
//           <div className="admin-skeleton" aria-hidden="true">
//             {Array.from({ length: 6 }, (_, i) => (
//               <span key={i} />
//             ))}
//           </div>
//         </div>
//       ) : filtrados.length === 0 ? (
//         <div className="admin-empty">
//           <h3>{vistas.length ? 'Sin resultados' : 'Todavía no hay socios'}</h3>
//           <p>{vistas.length ? 'Ningún socio coincide con los filtros.' : 'Los socios registrados van a aparecer acá.'}</p>
//         </div>
//       ) : (
//         <>
//           <div className="admin-table-wrap">
//             <table className="admin-table inv-tabla soc-tabla">
//               <thead>
//                 <tr>
//                   <th scope="col">Socio</th>
//                   <th scope="col">DNI</th>
//                   <th scope="col">Estado</th>
//                   <th scope="col">Préstamos</th>
//                   <th scope="col">Sanciones vigentes</th>
//                   <th scope="col" className="acciones">
//                     Acción
//                   </th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {visibles.map((s) => (
//                   <tr key={s.id} className={s.vencidos.length ? 'soc-moroso' : s.estado === SocioEstado.BAJA ? 'inv-baja' : ''}>
//                     <td>
//                       <strong>
//                         {s.apellido}, {s.nombre}
//                       </strong>
//                       <small className="inv-sub">N° {s.id}</small>
//                     </td>
//                     <td className="mono">{s.dni}</td>
//                     <td>
//                       <span className={`estado-pill est-soc-${s.estado.toLowerCase()}`}>
//                         <i aria-hidden="true" />
//                         {ETIQUETA_ESTADO_SOCIO[s.estado]}
//                       </span>
//                     </td>
//                     <td>
//                       {s.abiertos ? `${s.abiertos} abierto${s.abiertos === 1 ? '' : 's'}` : <span className="muted">—</span>}
//                       {s.vencidos.length > 0 && (
//                         <small className="inv-sub soc-vencidos">
//                           {s.vencidos.length} vencido{s.vencidos.length === 1 ? '' : 's'}
//                         </small>
//                       )}
//                     </td>
//                     <td>
//                       {s.sanciones.length ? (
//                         <span className="soc-sanciones">
//                           {s.sanciones.map((x) => (
//                             <span key={x.id} className={`soc-sancion ${x.tipo.toLowerCase()}`}>
//                               {ETIQUETA_SANCION[x.tipo]}
//                             </span>
//                           ))}
//                         </span>
//                       ) : (
//                         <span className="muted">—</span>
//                       )}
//                     </td>
//                     <td className="acciones">
//                       <button className={`inv-accion${s.vencidos.length ? ' peligro' : ''}`} onClick={() => setFichaId(s.id)}>
//                         {s.vencidos.length ? 'Sancionar' : 'Ver ficha'}
//                       </button>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>

//           {totalPaginas > 1 && (
//             <div className="admin-paginacion">
//               <button className="ghost-btn" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>
//                 ← Anterior
//               </button>
//               <span>
//                 Página {paginaActual} de {totalPaginas} · {filtrados.length} socios
//               </span>
//               <button
//                 className="ghost-btn"
//                 disabled={paginaActual === totalPaginas}
//                 onClick={() => setPagina(paginaActual + 1)}
//               >
//                 Siguiente →
//               </button>
//             </div>
//           )}
//         </>
//       )}

//       {ficha && usuario && (
//         <SocioFichaModal
//           socio={ficha}
//           usuarioId={usuario.id}
//           onCerrar={() => setFichaId(null)}
//           onCambio={(texto) => {
//             // Se cierra la ficha para que se vea el aviso y el padrón actualizado
//             setFichaId(null);
//             setAviso({ tipo: 'ok', texto });
//             void cargar();
//           }}
//         />
//       )}
//     </section>
//   );
// }

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminIcon from '../../components/admin/AdminIcon';
import { mensajeDeError, type Aviso } from '../../components/mostrador/avisos';
import SocioFichaModal, { estaAtrasado, type SocioVista } from '../../components/socios/SocioFichaModal';
import { useAuth } from '../../context/AuthContext';
import { sociosService } from '../../services/sociosService';
import { PrestamoEstado, SocioEstado } from '../../types/enums';
import type { PrestamoListado } from '../../types/mostrador';
import { ETIQUETA_ESTADO_SOCIO, ETIQUETA_SANCION, type Sancion, type Socio } from '../../types/socios';
import { normalizar } from '../../utils/texto';
import './socios.css';

const POR_PAGINA = 20;
type Filtro = 'todos' | 'morosos' | SocioEstado;

/**
 * F8.3 / F8.4 – Padrón de socios con su estado, resaltando a quienes tienen préstamos
 * vencidos (morosos). Desde la ficha de cada socio se aplican sanciones (MULTA o SUSPENSION)
 * sobre un préstamo y se levantan las vigentes.
 */
export default function SociosPage() {
  const { usuario } = useAuth();
  const [socios, setSocios] = useState<Socio[]>([]);
  const [prestamos, setPrestamos] = useState<PrestamoListado[]>([]);
  const [sanciones, setSanciones] = useState<Sancion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [pagina, setPagina] = useState(1);
  const [fichaId, setFichaId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [s, p, sa] = await Promise.all([
        sociosService.listar(),
        sociosService.prestamos(),
        sociosService.sancionesVigentes(),
      ]);
      setSocios(s);
      setPrestamos(p);
      setSanciones(sa);
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo cargar el padrón.'));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 6000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  useEffect(() => setPagina(1), [busqueda, filtro]);

  // Cruza cada socio con sus préstamos y sanciones vigentes
  const vistas: SocioVista[] = useMemo(() => {
    const prestamosDe = new Map<number, PrestamoListado[]>();
    for (const p of prestamos) prestamosDe.set(p.socio_id, [...(prestamosDe.get(p.socio_id) ?? []), p]);
    const sancionesDe = new Map<number, Sancion[]>();
    for (const s of sanciones) sancionesDe.set(s.socio_id, [...(sancionesDe.get(s.socio_id) ?? []), s]);
    return socios.map((s) => {
      const suyos = prestamosDe.get(s.id) ?? [];
      return {
        ...s,
        prestamos: suyos,
        abiertos: suyos.filter((p) => p.estado !== PrestamoEstado.FINALIZADO).length,
        vencidos: suyos.filter(estaAtrasado),
        sanciones: sancionesDe.get(s.id) ?? [],
      };
    });
  }, [socios, prestamos, sanciones]);

  const conteo = useMemo(
    () => ({
      todos: vistas.length,
      morosos: vistas.filter((s) => s.vencidos.length > 0).length,
      [SocioEstado.ACTIVO]: vistas.filter((s) => s.estado === SocioEstado.ACTIVO).length,
      [SocioEstado.SUSPENDIDO]: vistas.filter((s) => s.estado === SocioEstado.SUSPENDIDO).length,
      [SocioEstado.BAJA]: vistas.filter((s) => s.estado === SocioEstado.BAJA).length,
      [SocioEstado.PENDIENTE_CUOTA]: vistas.filter((s) => s.estado === SocioEstado.PENDIENTE_CUOTA).length,
    }),
    [vistas],
  );

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    return vistas
      .filter(
        (s) =>
          (filtro === 'todos' || (filtro === 'morosos' ? s.vencidos.length > 0 : s.estado === filtro)) &&
          (!q ||
            normalizar(s.nombre_usuario).includes(q) ||
            normalizar(`${s.nombre} ${s.apellido}`).includes(q) ||
            normalizar(`${s.apellido} ${s.nombre}`).includes(q) ||
            s.dni.includes(q) ||
            String(s.id) === q),
      )
      // Los morosos primero, después por apellido
      .sort((a, b) => Number(b.vencidos.length > 0) - Number(a.vencidos.length > 0));
  }, [vistas, filtro, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  const ficha = vistas.find((s) => s.id === fichaId) ?? null;

  const FILTROS: { id: Filtro; texto: string; clase: string }[] = [
    { id: 'todos', texto: 'Todos', clase: '' },
    { id: 'morosos', texto: 'Con préstamos vencidos', clase: 'est-moroso' },
    { id: SocioEstado.ACTIVO, texto: 'Activos', clase: 'est-soc-activo' },
    { id: SocioEstado.SUSPENDIDO, texto: 'Suspendidos', clase: 'est-soc-suspendido' },
    { id: SocioEstado.BAJA, texto: 'Baja', clase: 'est-soc-baja' },
  ];

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <span className="eyebrow">PADRÓN Y SANCIONES</span>
          <h1>
            <em>Socios</em>
          </h1>
          <p className="muted">
            {cargando
              ? 'Cargando…'
              : `${conteo.todos} socios · ${conteo.morosos} con préstamos vencidos · ${sanciones.length} sanciones vigentes`}
          </p>
        </div>
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

      <div className="inv-filtros">
        <label className="admin-search">
          <AdminIcon name="search" size={17} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Usuario, nombre, apellido, DNI o N° de socio"
            aria-label="Buscar socio"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} aria-label="Borrar búsqueda">
              <AdminIcon name="close" size={15} />
            </button>
          )}
        </label>
      </div>

      <div className="inv-estados" role="group" aria-label="Filtrar socios">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            className={`${filtro === f.id ? 'activo ' : ''}${f.clase}`}
            onClick={() => setFiltro(f.id)}
            aria-pressed={filtro === f.id}
          >
            {f.clase && <i aria-hidden="true" />}
            {f.texto} <b>{conteo[f.id]}</b>
          </button>
        ))}
      </div>

      {error ? (
        <div className="admin-empty">
          <h3>No pudimos cargar el padrón</h3>
          <p>{error}</p>
          <button className="ghost-btn" onClick={() => void cargar()}>
            Reintentar
          </button>
        </div>
      ) : cargando ? (
        <div className="admin-table-wrap">
          <div className="admin-skeleton" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="admin-empty">
          <h3>{vistas.length ? 'Sin resultados' : 'Todavía no hay socios'}</h3>
          <p>{vistas.length ? 'Ningún socio coincide con los filtros.' : 'Los socios registrados van a aparecer acá.'}</p>
        </div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table inv-tabla soc-tabla">
              <thead>
                <tr>
                  <th scope="col">Socio (Apellido, nombre)</th>
                  <th scope="col">Usuario</th>
                  <th scope="col">DNI</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Préstamos</th>
                  <th scope="col">Sanciones vigentes</th>
                  <th scope="col" className="acciones">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((s) => (
                  <tr
                    key={s.id}
                    className={s.vencidos.length ? 'soc-moroso' : s.estado === SocioEstado.BAJA ? 'inv-baja' : ''}
                  >
                    <td>
                      <strong>
                        {s.apellido}, {s.nombre}
                      </strong>
                      <small className="inv-sub">N° {s.id}</small>
                    </td>
                    <td className="mono">
                      {s.nombre_usuario ? s.nombre_usuario : <span className="muted">—</span>}
                    </td>
                    <td className="mono">{s.dni}</td>
                    <td>
                      <span className={`estado-pill est-soc-${s.estado.toLowerCase()}`}>
                        <i aria-hidden="true" />
                        {ETIQUETA_ESTADO_SOCIO[s.estado]}
                      </span>
                    </td>
                    <td>
                      {s.abiertos ? `${s.abiertos} abierto${s.abiertos === 1 ? '' : 's'}` : <span className="muted">—</span>}
                      {s.vencidos.length > 0 && (
                        <small className="inv-sub soc-vencidos">
                          {s.vencidos.length} vencido{s.vencidos.length === 1 ? '' : 's'}
                        </small>
                      )}
                    </td>
                    <td>
                      {s.sanciones.length ? (
                        <span className="soc-sanciones">
                          {s.sanciones.map((x) => (
                            <span key={x.id} className={`soc-sancion ${x.tipo.toLowerCase()}`}>
                              {ETIQUETA_SANCION[x.tipo]}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="acciones">
                      <button className={`inv-accion${s.vencidos.length ? ' peligro' : ''}`} onClick={() => setFichaId(s.id)}>
                        {s.vencidos.length ? 'Sancionar' : 'Ver ficha'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="admin-paginacion">
              <button className="ghost-btn" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>
                ← Anterior
              </button>
              <span>
                Página {paginaActual} de {totalPaginas} · {filtrados.length} socios
              </span>
              <button
                className="ghost-btn"
                disabled={paginaActual === totalPaginas}
                onClick={() => setPagina(paginaActual + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}

      {ficha && usuario && (
        <SocioFichaModal
          socio={ficha}
          usuarioId={usuario.id}
          onCerrar={() => setFichaId(null)}
          onCambio={(texto) => {
            // Se cierra la ficha para que se vea el aviso y el padrón actualizado
            setFichaId(null);
            setAviso({ tipo: 'ok', texto });
            void cargar();
          }}
        />
      )}
    </section>
  );
}