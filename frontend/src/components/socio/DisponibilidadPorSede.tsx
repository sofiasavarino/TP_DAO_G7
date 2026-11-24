// import type { Sede } from '../../types/ejemplares';
// import { copiasEnSede, type Disponibilidad } from '../../utils/disponibilidad';

// interface Props {
//   libroId: number;
//   sedes: Sede[];
//   disponibilidad: Disponibilidad;
//   /** Sede del socio: se marca como "tu sede" */
//   sedePropiaId?: number | null;
// }

// /** F3.3 – Copias en estado DISPONIBLE del libro en cada sucursal. */
// export default function DisponibilidadPorSede({ libroId, sedes, disponibilidad, sedePropiaId }: Props) {
//   return (
//     <ul className="disponibilidad-sedes">
//       {sedes.map((sede) => {
//         const copias = copiasEnSede(disponibilidad, libroId, sede.id);
//         return (
//           <li key={sede.id} className={copias ? 'con-copias' : ''}>
//             <div>
//               <strong>
//                 {sede.nombre}
//                 {sede.id === sedePropiaId && <em> · tu sede</em>}
//               </strong>
//               <small>{sede.direccion}</small>
//             </div>
//             <span>
//               {copias ? `${copias} ${copias === 1 ? 'disponible' : 'disponibles'}` : 'Sin copias'}
//             </span>
//           </li>
//         );
//       })}
//     </ul>
//   );
// }
import type { Sede } from '../../types/ejemplares';
import { copiasEnSede, type Disponibilidad } from '../../utils/disponibilidad';

interface Props {
  libroId: number;
  sedes: Sede[];
  disponibilidad: Disponibilidad;
  sedePropiaId: number | null;
}

/** Lista de sedes con estado de disponibilidad del libro (vista del socio). */
export default function DisponibilidadPorSede({
  libroId,
  sedes,
  disponibilidad,
  sedePropiaId,
}: Props) {
  return (
    <ul className="branch-list">
      {sedes.map((sede) => {
        const hayDisponibilidad = copiasEnSede(disponibilidad, libroId, sede.id) > 0;
        const esPropia = sede.id === sedePropiaId;
        return (
          <li key={sede.id} className={hayDisponibilidad ? 'ok' : 'none'}>
            <div>
              <strong>
                {sede.nombre}
                {esPropia && <small className="own-tag"> · tu sede</small>}
              </strong>
              <span>{sede.direccion}</span>
            </div>
            <b>{hayDisponibilidad ? 'Disponible' : 'Sin disponibilidad'}</b>
          </li>
        );
      })}
    </ul>
  );
}