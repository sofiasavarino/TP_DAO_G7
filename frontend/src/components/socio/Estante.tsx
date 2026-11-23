import { useRef } from 'react';
import type { Sede } from '../../types/ejemplares';
import type { LibroListado } from '../../types/libros';
import type { Disponibilidad } from '../../utils/disponibilidad';
import Icon from './Icon';
import LibroCard from './LibroCard';

interface Props {
  titulo: string;
  kicker: string;
  libros: LibroListado[];
  sedes: Sede[];
  disponibilidad: Disponibilidad;
  reservados: Set<number>;
  onOpen: (libro: LibroListado) => void;
  onReserve: (libro: LibroListado) => void;
}

/** Fila horizontal de libros con flechas (la "estantería" del diseño de Figma). */
export default function Estante({ titulo, kicker, libros, ...card }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mover = (direccion: number) =>
    ref.current?.scrollBy({
      left: direccion * Math.min(ref.current.clientWidth * 0.8, 780),
      behavior: 'smooth',
    });

  return (
    <section className="shelf-section">
      <div className="section-heading">
        <div>
          <span>{kicker}</span>
          <h2>{titulo}</h2>
        </div>
        <div className="shelf-actions">
          <button onClick={() => mover(-1)} aria-label="Ver libros anteriores" className="prev">
            <Icon name="arrow" />
          </button>
          <button onClick={() => mover(1)} aria-label="Ver más libros">
            <Icon name="arrow" />
          </button>
        </div>
      </div>
      <div className="books-row" ref={ref}>
        {libros.map((libro) => (
          <LibroCard
            key={libro.id}
            libro={libro}
            sedes={card.sedes}
            disponibilidad={card.disponibilidad}
            reservado={card.reservados.has(libro.id)}
            onOpen={card.onOpen}
            onReserve={card.onReserve}
          />
        ))}
      </div>
    </section>
  );
}
