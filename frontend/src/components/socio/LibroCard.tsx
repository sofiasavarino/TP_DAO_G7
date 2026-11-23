import type { Sede } from '../../types/ejemplares';
import type { LibroListado } from '../../types/libros';
import { sedesConCopias, totalCopias, type Disponibilidad } from '../../utils/disponibilidad';
import { nombresAutores } from '../../utils/libros';
import Portada from './Portada';

interface Props {
  libro: LibroListado;
  sedes: Sede[];
  disponibilidad: Disponibilidad;
  /** El socio ya tiene una reserva viva de este libro */
  reservado: boolean;
  onOpen: (libro: LibroListado) => void;
  onReserve: (libro: LibroListado) => void;
}

/** Tarjeta del catálogo: tapa y, al pasar el mouse, autor, copias por sede y "Reservar". */
export default function LibroCard({ libro, sedes, disponibilidad, reservado, onOpen, onReserve }: Props) {
  const total = totalCopias(disponibilidad, libro.id);
  const porSede = sedesConCopias(disponibilidad, libro.id, sedes);

  return (
    <article
      className="book-card group"
      role="link"
      tabIndex={0}
      onClick={() => onOpen(libro)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(libro)}
    >
      <Portada src={libro.imagen_url} titulo={libro.nombre} />
      <div className="book-spine" />
      <div className="book-overlay">
        <span className={`availability${total ? '' : ' sin-copias'}`}>
          {total ? `${total} ${total === 1 ? 'copia disponible' : 'copias disponibles'}` : 'Sin copias disponibles'}
        </span>
        <div>
          <h3>{libro.nombre}</h3>
          <p>{nombresAutores(libro)}</p>
          {porSede.length > 0 && (
            <ul className="card-sedes" aria-label="Copias disponibles por sede">
              {porSede.map(({ sede, copias }) => (
                <li key={sede.id}>
                  {sede.nombre} <b>{copias}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          disabled={reservado}
          onClick={(e) => {
            e.stopPropagation();
            onReserve(libro);
          }}
          aria-label={`Reservar ${libro.nombre}`}
        >
          {reservado ? 'Ya reservado' : 'Reservar'}
        </button>
      </div>
    </article>
  );
}
