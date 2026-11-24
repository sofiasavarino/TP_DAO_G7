// import Icon from '../../components/socio/Icon';
// import Portada from '../../components/socio/Portada';
// import { PrestamoEstado, PrestamoTipo } from '../../types/enums';
// import type { LibroListado } from '../../types/libros';
// import type { PrestamoSocio } from '../../types/socio';
// import { daysLeft, fmt } from '../../utils/fechas';
// import { nombresAutores } from '../../utils/libros';
// import { plural } from '../../utils/sanciones';

// interface Props {
//   prestamos: PrestamoSocio[];
//   cargando: boolean;
//   error: string | null;
//   onReintentar: () => void;
//   /** Para mostrar el autor y abrir la ficha (el préstamo trae solo el título) */
//   libros: LibroListado[];
//   onOpenLibro: (libro: LibroListado) => void;
//   /** Reseñas (locales por ahora): etiqueta del botón y acción */
//   tieneResena: (libroId: number) => boolean;
//   onResenar: (prestamo: PrestamoSocio) => void;
//   onExplore: () => void;
// }

// const TIPO: Record<PrestamoTipo, string> = {
//   [PrestamoTipo.LOCAL]: 'Local',
//   [PrestamoTipo.INTERBIBLIOTECARIO]: 'Interbibliotecario',
// };

// const ABIERTOS = [PrestamoEstado.ACTIVO, PrestamoEstado.VENCIDO];

// /** F4.3 – Préstamos del socio: actuales (ACTIVO / VENCIDO) e historial (FINALIZADO). */
// export default function PrestamosPage({
//   prestamos,
//   cargando,
//   error,
//   onReintentar,
//   libros,
//   onOpenLibro,
//   tieneResena,
//   onResenar,
//   onExplore,
// }: Props) {
//   const actuales = prestamos.filter((p) => ABIERTOS.includes(p.estado));
//   const historial = prestamos.filter((p) => !ABIERTOS.includes(p.estado));

//   const fila = (p: PrestamoSocio) => {
//     const libro = libros.find((l) => l.id === p.libro_id);
//     const abierto = ABIERTOS.includes(p.estado);
//     const dias = daysLeft(p.fecha_vencimiento);
//     // El backend marca VENCIDO en un proceso aparte: si ya pasó la fecha lo mostramos vencido igual
//     const vencido = abierto && (p.estado === PrestamoEstado.VENCIDO || dias < 0);

//     const lineas = [`Retirado el ${fmt(p.fecha_inicio)}`];
//     if (abierto) {
//       lineas.push(`Devolvelo hasta el ${fmt(p.fecha_vencimiento)}`);
//       lineas.push(
//         dias > 0 ? `Te ${dias === 1 ? 'queda' : 'quedan'} ${plural(dias, 'día', 'días')}` : dias === 0 ? 'Vence hoy' : `Vencido hace ${plural(-dias, 'día', 'días')}`,
//       );
//     } else {
//       lineas.push(p.fecha_devolucion ? `Devuelto el ${fmt(p.fecha_devolucion)}` : `Vencía el ${fmt(p.fecha_vencimiento)}`);
//     }

//     return (
//       <article key={p.id} className={vencido ? 'is-overdue' : ''}>
//         <Portada src={p.libro_imagen_url} isbn={p.libro_isbn} titulo={p.libro_nombre} />
//         <div>
//           <span>{vencido ? 'VENCIDO' : abierto ? 'EN TU PODER' : 'DEVUELTO'}</span>
//           <h2>{p.libro_nombre}</h2>
//           <p>{libro ? nombresAutores(libro) : ''}</p>
//           {lineas.map((l, i) => (
//             <small key={i} className={vencido && i === 2 ? 'overdue-line' : ''}>
//               {l}
//             </small>
//           ))}
//           <small>
//             Préstamo {p.numero} · <em className="badge">{TIPO[p.tipo]}</em>
//           </small>
//           {vencido && (
//             <small className="overdue-line">
//               Devolvelo cuanto antes: al devolverlo se aplica una multa por cada día de atraso.
//             </small>
//           )}
//         </div>
//         <div className="row-actions">
//           <button onClick={() => onResenar(p)}>{tieneResena(p.libro_id) ? 'Editar reseña' : 'Calificar y reseñar'}</button>
//           {libro && <button onClick={() => onOpenLibro(libro)}>Ver libro</button>}
//         </div>
//       </article>
//     );
//   };

//   return (
//     <section className="reservations-page">
//       <span className="eyebrow">TU CUENTA</span>
//       <h1>Préstamos</h1>
//       <p>Los libros que tenés en casa, cuándo devolverlos y tu historial de lecturas. Cada préstamo dura 15 días.</p>

//       {error ? (
//         <div className="empty">
//           <Icon name="book" size={34} />
//           <h3>No pudimos cargar tus préstamos</h3>
//           <p>{error}</p>
//           <button onClick={onReintentar}>Reintentar</button>
//         </div>
//       ) : cargando && !prestamos.length ? (
//         <p className="muted">Cargando tus préstamos…</p>
//       ) : (
//         <>
//           <h3 className="list-title">Para devolver</h3>
//           <div className="reservation-list">
//             {actuales.map(fila)}
//             {!actuales.length && (
//               <div className="empty">
//                 <Icon name="book" size={34} />
//                 <h3>No tenés libros pendientes de devolución</h3>
//                 <p>Reservá un libro y retiralo en tu sede.</p>
//                 <button onClick={onExplore}>Explorar catálogo</button>
//               </div>
//             )}
//           </div>
//           <h3 className="list-title">Historial</h3>
//           <div className="reservation-list">
//             {historial.map(fila)}
//             {!historial.length && <p className="muted">Todavía no tenés préstamos finalizados.</p>}
//           </div>
//         </>
//       )}
//     </section>
//   );
// }

// import Icon from '../../components/socio/Icon';
// import Portada from '../../components/socio/Portada';
// import { PrestamoEstado, PrestamoTipo } from '../../types/enums';
// import type { LibroListado } from '../../types/libros';
// import type { PrestamoSocio } from '../../types/socio';
// import { daysLeft, fmt } from '../../utils/fechas';
// import { nombresAutores } from '../../utils/libros';
// import { plural } from '../../utils/sanciones';

// interface Props {
//   prestamos: PrestamoSocio[];
//   cargando: boolean;
//   error: string | null;
//   onReintentar: () => void;
//   /** Para mostrar el autor y abrir la ficha (el préstamo trae solo el título) */
//   libros: LibroListado[];
//   onOpenLibro: (libro: LibroListado) => void;
//   /** Reseñas (locales por ahora): etiqueta del botón y acción */
//   tieneResena: (libroId: number) => boolean;
//   onResenar: (prestamo: PrestamoSocio) => void;
//   onExplore: () => void;
// }

// const TIPO: Record<PrestamoTipo, string> = {
//   [PrestamoTipo.LOCAL]: 'Local',
//   [PrestamoTipo.INTERBIBLIOTECARIO]: 'Interbibliotecario',
// };

// const ABIERTOS = [PrestamoEstado.ACTIVO, PrestamoEstado.VENCIDO];

// /** F4.3 – Préstamos del socio: actuales (ACTIVO / VENCIDO) e historial (FINALIZADO). */
// export default function PrestamosPage({
//   prestamos,
//   cargando,
//   error,
//   onReintentar,
//   libros,
//   onOpenLibro,
//   tieneResena,
//   onResenar,
//   onExplore,
// }: Props) {
//   const actuales = prestamos.filter((p) => ABIERTOS.includes(p.estado));
//   const historial = prestamos.filter((p) => !ABIERTOS.includes(p.estado));

//   const fila = (p: PrestamoSocio) => {
//     const libro = libros.find((l) => l.id === p.libro_id);
//     const abierto = ABIERTOS.includes(p.estado);
//     const dias = daysLeft(p.fecha_vencimiento);
//     // El backend marca VENCIDO en un proceso aparte: si ya pasó la fecha lo mostramos vencido igual
//     const vencido = abierto && (p.estado === PrestamoEstado.VENCIDO || dias < 0);

//     const tiempoRestante = abierto
//       ? dias > 0
//         ? `Te ${dias === 1 ? 'queda' : 'quedan'} ${plural(dias, 'día', 'días')}`
//         : dias === 0
//           ? 'Vence hoy'
//           : `Vencido hace ${plural(-dias, 'día', 'días')}`
//       : null;

//     return (
//       <article key={p.id} className={vencido ? 'is-overdue' : ''}>
//         <Portada src={p.libro_imagen_url} isbn={p.libro_isbn} titulo={p.libro_nombre} />
//         <div className="reservation-info">
//           <span className={`res-status ${vencido ? 'is-pending' : abierto ? 'is-ready' : ''}`}>
//             {vencido ? 'VENCIDO' : abierto ? 'EN TU PODER' : 'DEVUELTO'}
//           </span>
//           <h2>{p.libro_nombre}</h2>
//           {libro && <p className="res-author">{nombresAutores(libro)}</p>}

//           <div className="res-meta">
//             <small>
//               <b>Retirado el:</b> {fmt(p.fecha_inicio)}
//             </small>
//             {abierto ? (
//               <>
//                 <small>
//                   <b>Devolvelo hasta el:</b> {fmt(p.fecha_vencimiento)}
//                 </small>
//                 {tiempoRestante && (
//                   <small className={vencido ? 'text-pending' : 'text-ready'}>
//                     {tiempoRestante}
//                   </small>
//                 )}
//               </>
//             ) : (
//               <small>
//                 {p.fecha_devolucion ? (
//                   <>
//                     <b>Devuelto el:</b> {fmt(p.fecha_devolucion)}
//                   </>
//                 ) : (
//                   <>
//                     <b>Vencía el:</b> {fmt(p.fecha_vencimiento)}
//                   </>
//                 )}
//               </small>
//             )}
//             <small>
//               <em className="badge">{TIPO[p.tipo]}</em>
//             </small>
//             {vencido && (
//               <small className="overdue-line">
//                 Devolvelo cuanto antes: al devolverlo se aplica una multa por cada día de atraso.
//               </small>
//             )}
//           </div>
//         </div>

//         <div className="row-actions">
//           <button type="button" className="btn-cta-libro" onClick={() => onResenar(p)}>
//             {tieneResena(p.libro_id) ? 'Editar reseña' : 'Calificar libro'}
//           </button>
//           {libro && (
//             <button type="button" className="btn-cancel-link" onClick={() => onOpenLibro(libro)}>
//               Ver libro
//             </button>
//           )}
//         </div>
//       </article>
//     );
//   };

//   return (
//     <section className="reservations-page">
//       <span className="eyebrow">TU CUENTA</span>
//       <h1>Préstamos</h1>
//       <p className="reservations-intro">
//         Los libros que tenés en casa, cuándo devolverlos y tu historial de lecturas. Cada préstamo dura 15 días.
//       </p>

//       {error ? (
//         <div className="empty">
//           <Icon name="book" size={34} />
//           <h3>No pudimos cargar tus préstamos</h3>
//           <p>{error}</p>
//           <button onClick={onReintentar}>Reintentar</button>
//         </div>
//       ) : cargando && !prestamos.length ? (
//         <p className="muted">Cargando tus préstamos…</p>
//       ) : (
//         <>
//           <h3 className="list-title">Para devolver</h3>
//           <div className="reservation-list">
//             {actuales.map(fila)}
//             {!actuales.length && (
//               <div className="empty">
//                 <Icon name="book" size={34} />
//                 <h3>No tenés libros pendientes de devolución</h3>
//                 <p>Reservá un libro y retiralo en tu sede.</p>
//                 <button onClick={onExplore}>Explorar catálogo</button>
//               </div>
//             )}
//           </div>
//           <h3 className="list-title">Historial</h3>
//           <div className="reservation-list">
//             {historial.map(fila)}
//             {!historial.length && <p className="muted">Todavía no tenés préstamos finalizados.</p>}
//           </div>
//         </>
//       )}
//     </section>
//   );
// }
import Icon from '../../components/socio/Icon';
import Portada from '../../components/socio/Portada';
import { PrestamoEstado } from '../../types/enums';
import type { LibroListado } from '../../types/libros';
import type { PrestamoSocio } from '../../types/socio';
import { daysLeft, fmt } from '../../utils/fechas';
import { nombresAutores } from '../../utils/libros';
import { plural } from '../../utils/sanciones';

interface Props {
  prestamos: PrestamoSocio[];
  cargando: boolean;
  error: string | null;
  onReintentar: () => void;
  /** Para mostrar el autor y abrir la ficha (el préstamo trae solo el título) */
  libros: LibroListado[];
  onOpenLibro: (libro: LibroListado) => void;
  /** Reseñas (locales por ahora): etiqueta del botón y acción */
  tieneResena: (libroId: number) => boolean;
  onResenar: (prestamo: PrestamoSocio) => void;
  onExplore: () => void;
}

const ABIERTOS = [PrestamoEstado.ACTIVO, PrestamoEstado.VENCIDO];

/** F4.3 – Préstamos del socio: actuales (ACTIVO / VENCIDO) e historial (FINALIZADO). */
export default function PrestamosPage({
  prestamos,
  cargando,
  error,
  onReintentar,
  libros,
  onOpenLibro,
  tieneResena,
  onResenar,
  onExplore,
}: Props) {
  const actuales = prestamos.filter((p) => ABIERTOS.includes(p.estado));
  const historial = prestamos.filter((p) => !ABIERTOS.includes(p.estado));

  const fila = (p: PrestamoSocio) => {
    const libro = libros.find((l) => l.id === p.libro_id);
    const abierto = ABIERTOS.includes(p.estado);
    const dias = daysLeft(p.fecha_vencimiento);
    // El backend marca VENCIDO en un proceso aparte: si ya pasó la fecha lo mostramos vencido igual
    const vencido = abierto && (p.estado === PrestamoEstado.VENCIDO || dias < 0);

    const tiempoRestante = abierto
      ? dias > 0
        ? `Te ${dias === 1 ? 'queda' : 'quedan'} ${plural(dias, 'día', 'días')}`
        : dias === 0
          ? 'Vence hoy'
          : `Vencido hace ${plural(-dias, 'día', 'días')}`
      : null;

    return (
      <article key={p.id} className={vencido ? 'is-overdue' : ''}>
        <Portada src={p.libro_imagen_url} isbn={p.libro_isbn} titulo={p.libro_nombre} />
        <div className="reservation-info">
          <span className={`res-status ${vencido ? 'is-pending' : abierto ? 'is-ready' : ''}`}>
            {vencido ? 'VENCIDO' : abierto ? 'EN TU PODER' : 'DEVUELTO'}
          </span>
          <h2>{p.libro_nombre}</h2>
          {libro && <p className="res-author">{nombresAutores(libro)}</p>}

          <div className="res-meta">
            <small>
              <b>Retirado el:</b> {fmt(p.fecha_inicio)}
            </small>
            {abierto ? (
              <>
                <small>
                  <b>Devolvelo hasta el:</b> {fmt(p.fecha_vencimiento)}
                </small>
                {tiempoRestante && (
                  <small className={vencido ? 'text-pending' : 'text-ready'}>
                    {tiempoRestante}
                  </small>
                )}
              </>
            ) : (
              <small>
                {p.fecha_devolucion ? (
                  <>
                    <b>Devuelto el:</b> {fmt(p.fecha_devolucion)}
                  </>
                ) : (
                  <>
                    <b>Vencía el:</b> {fmt(p.fecha_vencimiento)}
                  </>
                )}
              </small>
            )}
            {vencido && (
              <small className="overdue-line">
                Devolvelo cuanto antes: al devolverlo se aplica una multa por cada día de atraso.
              </small>
            )}
          </div>
        </div>

        <div className="row-actions">
          <button type="button" className="btn-cta-libro" onClick={() => onResenar(p)}>
            {tieneResena(p.libro_id) ? 'Editar reseña' : 'Calificar libro'}
          </button>
          {libro && (
            <button type="button" className="btn-cancel-link" onClick={() => onOpenLibro(libro)}>
              Ver libro
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <section className="reservations-page">
      <span className="eyebrow">TU CUENTA</span>
      <h1>Préstamos</h1>
      <p className="reservations-intro">
        Los libros que tenés en casa, cuándo devolverlos y tu historial de lecturas. Cada préstamo dura 15 días.
      </p>

      {error ? (
        <div className="empty">
          <Icon name="book" size={34} />
          <h3>No pudimos cargar tus préstamos</h3>
          <p>{error}</p>
          <button onClick={onReintentar}>Reintentar</button>
        </div>
      ) : cargando && !prestamos.length ? (
        <p className="muted">Cargando tus préstamos…</p>
      ) : (
        <>
          <h3 className="list-title">Para devolver</h3>
          <div className="reservation-list">
            {actuales.map(fila)}
            {!actuales.length && (
              <div className="empty">
                <Icon name="book" size={34} />
                <h3>No tenés libros pendientes de devolución</h3>
                <p>Reservá un libro y retiralo en tu sede.</p>
                <button onClick={onExplore}>Explorar catálogo</button>
              </div>
            )}
          </div>
          <h3 className="list-title">Historial</h3>
          <div className="reservation-list">
            {historial.map(fila)}
            {!historial.length && <p className="muted">Todavía no tenés préstamos finalizados.</p>}
          </div>
        </>
      )}
    </section>
  );
}