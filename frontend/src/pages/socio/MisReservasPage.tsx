// import { useState } from 'react';
// import Icon from '../../components/socio/Icon';
// import Portada from '../../components/socio/Portada';
// import { useAuth } from '../../context/AuthContext';
// import { ApiError } from '../../services/api';
// import { reservasService } from '../../services/reservasService';
// import type { Sede } from '../../types/ejemplares';
// import { ReservaEstado } from '../../types/enums';
// import type { LibroListado } from '../../types/libros';
// import { ESTADOS_RESERVA_VIVA, type Reserva } from '../../types/reservas';
// import { daysLeft, fmt } from '../../utils/fechas';
// import { nombresAutores } from '../../utils/libros';

// interface Props {
//   reservas: Reserva[];
//   cargando: boolean;
//   error: string | null;
//   onReintentar: () => void;
//   /** Para mostrar título, autor y tapa (la reserva solo trae libro_id) */
//   libros: LibroListado[];
//   /** Para mostrar el nombre de la sede de retiro (la reserva solo trae sede_retiro_id) */
//   sedes: Sede[];
//   /** Después de cancelar: recargar reservas y disponibilidad */
//   onCancelada: () => void;
//   onExplore: () => void;
//   onOpenLibro: (libro: LibroListado) => void;
// }

// /** Etiqueta y detalle de cada reserva según su estado real en el backend. */
// function describir(r: Reserva): { etiqueta: string; lineas: string[]; alerta?: boolean } {
//   const reservadoEl = `Reservado el ${fmt(r.fecha_reserva)}`;
//   switch (r.estado) {
//     case ReservaEstado.LISTA_PARA_RETIRO: {
//       const dias = r.fecha_vencimiento_retiro ? daysLeft(r.fecha_vencimiento_retiro) : null;
//       return {
//         etiqueta: 'LISTO PARA RETIRAR',
//         lineas: [
//           r.fecha_vencimiento_retiro
//             ? `Retiralo hasta el ${fmt(r.fecha_vencimiento_retiro)}${
//                 dias === 0 ? ' (hoy es el último día)' : dias === 1 ? ' (queda 1 día)' : ''
//               }`
//             : 'Ya podés retirarlo',
//           reservadoEl,
//         ],
//         alerta: dias !== null && dias <= 0,
//       };
//     }
//     case ReservaEstado.EN_TRANSITO:
//       return { etiqueta: 'EN CAMINO A TU SEDE', lineas: ['La copia está viajando; te avisamos cuando llegue', reservadoEl] };
//     case ReservaEstado.PENDIENTE:
//       return r.ejemplar_id
//         ? { etiqueta: 'PREPARANDO ENVÍO', lineas: ['Pedimos una copia desde otra sede', reservadoEl] }
//         : { etiqueta: 'EN LISTA DE ESPERA', lineas: ['Te asignamos una copia apenas se devuelva una', reservadoEl] };
//     case ReservaEstado.CUMPLIDA:
//       return {
//         etiqueta: 'RETIRADA',
//         lineas: [r.fecha_asignacion ? `Asignada el ${fmt(r.fecha_asignacion)}` : reservadoEl, 'El préstamo figura en "Préstamos"'],
//       };
//     case ReservaEstado.VENCIDA:
//       return {
//         etiqueta: 'VENCIDA',
//         lineas: [
//           r.fecha_vencimiento_retiro ? `No se retiró antes del ${fmt(r.fecha_vencimiento_retiro)}` : 'No se retiró a tiempo',
//           reservadoEl,
//         ],
//       };
//     default:
//       return { etiqueta: 'CANCELADA', lineas: [reservadoEl] };
//   }
// }

// /** F4 – Mis reservas con datos reales (GET /reservas/mios) y cancelación (DELETE /reservas/{id}). */
// export default function MisReservasPage({
//   reservas,
//   cargando,
//   error,
//   onReintentar,
//   libros,
//   sedes,
//   onCancelada,
//   onExplore,
//   onOpenLibro,
// }: Props) {
//   const { usuario } = useAuth();
//   const [aCancelar, setACancelar] = useState<Reserva | null>(null);
//   const [cancelando, setCancelando] = useState(false);
//   const [errorCancelar, setErrorCancelar] = useState<string | null>(null);

//   const libroDe = (r: Reserva) => libros.find((l) => l.id === r.libro_id);
//   const sedeDe = (r: Reserva) => sedes.find((s) => s.id === r.sede_retiro_id)?.nombre ?? `Sede ${r.sede_retiro_id}`;
//   const tituloDe = (r: Reserva) => libroDe(r)?.nombre ?? `Libro #${r.libro_id}`;

//   const activas = reservas.filter((r) => ESTADOS_RESERVA_VIVA.includes(r.estado));
//   const historial = reservas.filter((r) => !ESTADOS_RESERVA_VIVA.includes(r.estado));

//   const confirmarCancelacion = async () => {
//     if (!aCancelar || !usuario) return;
//     setCancelando(true);
//     setErrorCancelar(null);
//     try {
//       await reservasService.cancelar(aCancelar.id, usuario.id);
//       setACancelar(null);
//       onCancelada();
//     } catch (e) {
//       setErrorCancelar(e instanceof ApiError ? e.message : 'No pudimos cancelar la reserva. Probá de nuevo.');
//     } finally {
//       setCancelando(false);
//     }
//   };

//   const fila = (r: Reserva) => {
//     const libro = libroDe(r);
//     const { etiqueta, lineas, alerta } = describir(r);
//     return (
//       <article key={r.id} className={alerta ? 'is-overdue' : ''}>
//         <Portada src={libro?.imagen_url} titulo={tituloDe(r)} />
//         <div>
//           <span>{etiqueta}</span>
//           <h2>{tituloDe(r)}</h2>
//           <p>{libro ? nombresAutores(libro) : ''}</p>
//           {lineas.map((l, i) => (
//             <small key={i}>{l}</small>
//           ))}
//           <small>Retiro en {sedeDe(r)}</small>
//         </div>
//         <div className="row-actions">
//           {ESTADOS_RESERVA_VIVA.includes(r.estado) && (
//             <button
//               onClick={() => {
//                 setErrorCancelar(null);
//                 setACancelar(r);
//               }}
//             >
//               Cancelar reserva
//             </button>
//           )}
//           {libro && <button onClick={() => onOpenLibro(libro)}>Ver libro</button>}
//         </div>
//       </article>
//     );
//   };

//   return (
//     <section className="reservations-page">
//       <span className="eyebrow">TU ESPACIO</span>
//       <h1>Mis reservas</h1>
//       <p>
//         Podés tener hasta 2 libros entre reservas activas y préstamos. Cuando tu libro está listo, tenés 2 días
//         hábiles para retirarlo.
//       </p>

//       {error ? (
//         <div className="empty">
//           <Icon name="bookmark" size={34} />
//           <h3>No pudimos cargar tus reservas</h3>
//           <p>{error}</p>
//           <button onClick={onReintentar}>Reintentar</button>
//         </div>
//       ) : cargando && !reservas.length ? (
//         <p className="muted">Cargando tus reservas…</p>
//       ) : (
//         <>
//           <h3 className="list-title">Activas</h3>
//           <div className="reservation-list">
//             {activas.map(fila)}
//             {!activas.length && (
//               <div className="empty">
//                 <Icon name="bookmark" size={34} />
//                 <h3>Aún no tenés reservas activas</h3>
//                 <p>Explorá el catálogo para encontrar tu próxima lectura.</p>
//                 <button onClick={onExplore}>Explorar catálogo</button>
//               </div>
//             )}
//           </div>
//           <h3 className="list-title">Historial</h3>
//           <div className="reservation-list">
//             {historial.map(fila)}
//             {!historial.length && <p className="muted">Todavía no tenés reservas anteriores.</p>}
//           </div>
//         </>
//       )}

//       {aCancelar && (
//         <div className="reservation-modal-backdrop" role="presentation">
//           <section className="reservation-modal" role="alertdialog" aria-modal="true" aria-labelledby="cancel-title">
//             <button className="modal-close" onClick={() => setACancelar(null)} disabled={cancelando} aria-label="Cerrar">
//               <Icon name="close" size={18} />
//             </button>
//             <span className="eyebrow">CANCELAR RESERVA</span>
//             <h2 id="cancel-title">¿Seguro que querés cancelarla?</h2>
//             <div className="modal-book">
//               <Portada src={libroDe(aCancelar)?.imagen_url} titulo={tituloDe(aCancelar)} className="mini" />
//               <div>
//                 <strong>{tituloDe(aCancelar)}</strong>
//                 <span>Retiro en {sedeDe(aCancelar)}</span>
//               </div>
//             </div>
//             <p className="muted">La copia queda libre para el siguiente socio en la lista.</p>
//             {errorCancelar && (
//               <div className="reserva-error" role="alert">
//                 <strong>No pudimos cancelar la reserva</strong>
//                 <span>{errorCancelar}</span>
//               </div>
//             )}
//             <div className="modal-actions">
//               <button className="ghost-btn" onClick={() => setACancelar(null)} disabled={cancelando}>
//                 Mantener reserva
//               </button>
//               <button className="confirm-reservation" onClick={confirmarCancelacion} disabled={cancelando}>
//                 {cancelando ? 'Cancelando…' : 'Sí, cancelar'}
//               </button>
//             </div>
//           </section>
//         </div>
//       )}
//     </section>
//   );
// }

import { useState } from 'react';
import Icon from '../../components/socio/Icon';
import Portada from '../../components/socio/Portada';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../services/api';
import { reservasService } from '../../services/reservasService';
import type { Sede } from '../../types/ejemplares';
import { ReservaEstado } from '../../types/enums';
import type { LibroListado } from '../../types/libros';
import { ESTADOS_RESERVA_VIVA, type Reserva } from '../../types/reservas';
import { daysLeft, fmt } from '../../utils/fechas';
import { nombresAutores } from '../../utils/libros';

interface Props {
  reservas: Reserva[];
  cargando: boolean;
  error: string | null;
  onReintentar: () => void;
  /** Para mostrar título, autor y tapa (la reserva solo trae libro_id) */
  libros: LibroListado[];
  /** Para mostrar el nombre de la sede de retiro (la reserva solo trae sede_retiro_id) */
  sedes: Sede[];
  /** Después de cancelar: recargar reservas y disponibilidad */
  onCancelada: () => void;
  onExplore: () => void;
  onOpenLibro: (libro: LibroListado) => void;
}

/** Etiqueta y detalle de cada reserva según su estado real en el backend. */
function describir(r: Reserva): { etiqueta: string; lineas: string[]; alerta?: boolean } {
  const reservadoEl = `Reservado el ${fmt(r.fecha_reserva)}`;
  switch (r.estado) {
    case ReservaEstado.LISTA_PARA_RETIRO: {
      const dias = r.fecha_vencimiento_retiro ? daysLeft(r.fecha_vencimiento_retiro) : null;
      return {
        etiqueta: 'LISTO PARA RETIRAR',
        lineas: [
          r.fecha_vencimiento_retiro
            ? `Retiralo hasta el ${fmt(r.fecha_vencimiento_retiro)}${
                dias === 0 ? ' (hoy es el último día)' : dias === 1 ? ' (queda 1 día)' : ''
              }`
            : 'Ya podés retirarlo',
          reservadoEl,
        ],
        alerta: dias !== null && dias <= 0,
      };
    }
    case ReservaEstado.EN_TRANSITO:
      return { etiqueta: 'EN CAMINO A TU SEDE', lineas: ['La copia está viajando; te avisamos cuando llegue', reservadoEl] };
    case ReservaEstado.PENDIENTE:
      return r.ejemplar_id
        ? { etiqueta: 'PREPARANDO ENVÍO', lineas: ['Pedimos una copia desde otra sede', reservadoEl] }
        : { etiqueta: 'EN LISTA DE ESPERA', lineas: ['Te asignamos una copia apenas se devuelva una', reservadoEl] };
    case ReservaEstado.CUMPLIDA:
      return {
        etiqueta: 'RETIRADA',
        lineas: [r.fecha_asignacion ? `Asignada el ${fmt(r.fecha_asignacion)}` : reservadoEl, 'El préstamo figura en "Préstamos"'],
      };
    case ReservaEstado.VENCIDA:
      return {
        etiqueta: 'VENCIDA',
        lineas: [
          r.fecha_vencimiento_retiro ? `No se retiró antes del ${fmt(r.fecha_vencimiento_retiro)}` : 'No se retiró a tiempo',
          reservadoEl,
        ],
      };
    default:
      return { etiqueta: 'CANCELADA', lineas: [reservadoEl] };
  }
}

/** F4 – Mis reservas con datos reales (GET /reservas/mios) y cancelación (DELETE /reservas/{id}). */
export default function MisReservasPage({
  reservas,
  cargando,
  error,
  onReintentar,
  libros,
  sedes,
  onCancelada,
  onExplore,
  onOpenLibro,
}: Props) {
  const { usuario } = useAuth();
  const [aCancelar, setACancelar] = useState<Reserva | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [errorCancelar, setErrorCancelar] = useState<string | null>(null);

  const libroDe = (r: Reserva) => libros.find((l) => l.id === r.libro_id);
  const sedeDe = (r: Reserva) => sedes.find((s) => s.id === r.sede_retiro_id)?.nombre ?? `Sede ${r.sede_retiro_id}`;
  const tituloDe = (r: Reserva) => libroDe(r)?.nombre ?? `Libro #${r.libro_id}`;

  const activas = reservas.filter((r) => ESTADOS_RESERVA_VIVA.includes(r.estado));
  const historial = reservas.filter((r) => !ESTADOS_RESERVA_VIVA.includes(r.estado));

  const confirmarCancelacion = async () => {
    if (!aCancelar || !usuario) return;
    setCancelando(true);
    setErrorCancelar(null);
    try {
      await reservasService.cancelar(aCancelar.id, usuario.id);
      setACancelar(null);
      onCancelada();
    } catch (e) {
      setErrorCancelar(e instanceof ApiError ? e.message : 'No pudimos cancelar la reserva. Probá de nuevo.');
    } finally {
      setCancelando(false);
    }
  };

  const fila = (r: Reserva) => {
    const libro = libroDe(r);
    const { etiqueta, lineas, alerta } = describir(r);
    return (
      <article key={r.id} className={alerta ? 'is-overdue' : ''}>
        <Portada src={libro?.imagen_url} titulo={tituloDe(r)} />
        <div className="reservation-info">
          <span className="res-status">{etiqueta}</span>
          <h2>{tituloDe(r)}</h2>
          {libro && <p className="res-author">{nombresAutores(libro)}</p>}
          <div className="res-meta">
            {lineas.map((l, i) => (
              <small key={i}>{l}</small>
            ))}
            <small>Retiro en {sedeDe(r)}</small>
          </div>
        </div>
        <div className="row-actions">
          {libro && (
            <button className="btn-cta-libro" onClick={() => onOpenLibro(libro)}>
              Ver libro
            </button>
          )}
          {ESTADOS_RESERVA_VIVA.includes(r.estado) && (
            <button
              className="btn-cancel-link"
              onClick={() => {
                setErrorCancelar(null);
                setACancelar(r);
              }}
            >
              Cancelar reserva
            </button>
          )}
        </div>
      </article>
    );
  };

  const libroModal = aCancelar ? libroDe(aCancelar) : undefined;
  const infoModal = aCancelar ? describir(aCancelar) : null;

  return (
    <section className="reservations-page">
      <span className="eyebrow">TU ESPACIO</span>
      <h1>Mis reservas</h1>
      <p className="reservations-intro">
        Podés tener hasta 2 libros entre reservas activas y préstamos. Cuando tu libro está listo, tenés 2 días
        hábiles para retirarlo.
      </p>

      {error ? (
        <div className="empty">
          <Icon name="bookmark" size={34} />
          <h3>No pudimos cargar tus reservas</h3>
          <p>{error}</p>
          <button onClick={onReintentar}>Reintentar</button>
        </div>
      ) : cargando && !reservas.length ? (
        <p className="muted">Cargando tus reservas…</p>
      ) : (
        <>
          <h3 className="list-title">Activas</h3>
          <div className="reservation-list">
            {activas.map(fila)}
            {!activas.length && (
              <div className="empty">
                <Icon name="bookmark" size={34} />
                <h3>Aún no tenés reservas activas</h3>
                <p>Explorá el catálogo para encontrar tu próxima lectura.</p>
                <button onClick={onExplore}>Explorar catálogo</button>
              </div>
            )}
          </div>
          <h3 className="list-title">Historial</h3>
          <div className="reservation-list">
            {historial.map(fila)}
            {!historial.length && <p className="muted">Todavía no tenés reservas anteriores.</p>}
          </div>
        </>
      )}

      {aCancelar && (
        <div className="reservation-modal-backdrop" role="presentation">
          <section className="reservation-modal" role="alertdialog" aria-modal="true" aria-labelledby="cancel-title">
            <button className="modal-close" onClick={() => setACancelar(null)} disabled={cancelando} aria-label="Cerrar">
              <Icon name="close" size={18} />
            </button>
            <span className="eyebrow">CANCELAR RESERVA</span>
            <h2 id="cancel-title">¿Seguro que querés cancelarla?</h2>

            <div className="modal-book modal-book-detail">
              <Portada src={libroModal?.imagen_url} titulo={tituloDe(aCancelar)} className="mini" />
              <div className="modal-book-meta">
                <strong>{tituloDe(aCancelar)}</strong>
                {libroModal && <span className="modal-book-author">{nombresAutores(libroModal)}</span>}
                <ul className="modal-reserva-datos">
                  <li>
                    <b>Estado:</b> {infoModal?.etiqueta}
                  </li>
                  <li>
                    <b>Sede de retiro:</b> {sedeDe(aCancelar)}
                  </li>
                  <li>
                    <b>Fecha de reserva:</b> {fmt(aCancelar.fecha_reserva)}
                  </li>
                  {aCancelar.fecha_vencimiento_retiro && (
                    <li>
                      <b>Vencimiento de retiro:</b> {fmt(aCancelar.fecha_vencimiento_retiro)}
                    </li>
                  )}
                </ul>
              </div>
            </div>

            <p className="muted">La copia queda libre para el siguiente socio en la lista.</p>
            {errorCancelar && (
              <div className="reserva-error" role="alert">
                <strong>No pudimos cancelar la reserva</strong>
                <span>{errorCancelar}</span>
              </div>
            )}
            <div className="modal-actions modal-actions-rect">
              <button
                type="button"
                className="confirm-reservation"
                onClick={() => setACancelar(null)}
                disabled={cancelando}
              >
                Mantener reserva
              </button>
              <button
                type="button"
                className="btn-cancel-secondary"
                onClick={confirmarCancelacion}
                disabled={cancelando}
              >
                {cancelando ? 'Cancelando…' : 'Sí, cancelar'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}