import { useEffect, useState, type ReactNode } from 'react';
import DisponibilidadPorSede from '../../components/socio/DisponibilidadPorSede';
import Portada from '../../components/socio/Portada';
import { librosService } from '../../services/librosService';
import type { Sede } from '../../types/ejemplares';
import type { Libro, LibroListado } from '../../types/libros';
import { totalCopias, type Disponibilidad } from '../../utils/disponibilidad';
import { traducirGenero } from '../../utils/generos';
import { nombresAutores } from '../../utils/libros';
import { anio, limpiarSinopsis } from '../../utils/texto';
interface Props {
  libro: LibroListado;
  sedes: Sede[];
  disponibilidad: Disponibilidad;
  sedePropiaId: number | null;
  reservado: boolean;
  soloLectura?: boolean;
  onReserve: (libro: LibroListado) => void;
  onBack: () => void;
  /** Bloque de reseñas (todavía local, sin endpoint en el backend) */
  children?: ReactNode;
}

/** Ficha del libro: datos del catálogo + disponibilidad por sede + reservar. */
export default function LibroDetalle({
  libro,
  sedes,
  disponibilidad,
  sedePropiaId,
  reservado,
  soloLectura,
  onReserve,
  onBack,
  children,
}: Props) {
  const [detalle, setDetalle] = useState<Libro | null>(null);
  useEffect(() => {
    let vigente = true;
    setDetalle(null);
    librosService
      .obtenerPorId(libro.id)
      .then((d) => vigente && setDetalle(d))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [libro.id]);

  const hayStock = totalCopias(disponibilidad, libro.id) > 0;
  const sinopsis = limpiarSinopsis(detalle?.sinopsis ?? libro.sinopsis);
  const ficha = [
    libro.editorial && `Editorial ${libro.editorial}`,
    anio(detalle?.fecha_publicacion) && `Publicado en ${anio(detalle?.fecha_publicacion)}`,
    detalle?.cant_paginas && `${detalle.cant_paginas} páginas`,
  ].filter(Boolean);

  return (
    <section className="book-detail">
      <button className="back-link" onClick={onBack}>
        ← Volver al catálogo
      </button>

      <div className="detail-grid">
        <Portada src={libro.imagen_url} titulo={libro.nombre} />
        <div>
          {libro.genero && <span className="eyebrow">{traducirGenero(libro.genero).toLocaleUpperCase('es')}</span>}
          <h1>{libro.nombre}</h1>
          <p className="detail-author">{nombresAutores(libro)}</p>
          {ficha.length > 0 && <p className="detail-synopsis">{ficha.join(' · ')}</p>}
          {sinopsis && (
            <p className="detail-synopsis" style={{ marginTop: 14, lineHeight: 1.65 }}>
              {sinopsis}
            </p>
          )}
        </div>
      </div>

      <div className="detail-availability-box">
        <p className="detail-avail">
          {hayStock ? (
            <>
              <b>Disponible</b> en la red de bibliotecas
            </>
          ) : (
            'No hay disponibilidad ahora: si reservás, quedás en la lista de espera.'
          )}
        </p>

        <DisponibilidadPorSede
          libroId={libro.id}
          sedes={sedes}
          disponibilidad={disponibilidad}
          sedePropiaId={sedePropiaId}
        />

        <div className="detail-actions">
          {!soloLectura && (
            <button
              className="confirm-reservation"
              disabled={reservado}
              onClick={() => onReserve(libro)}
            >
              {reservado ? 'Ya lo reservaste' : 'Reservar este libro'}
            </button>
          )}
          <button type="button" className="ghost-btn detail-back-btn" onClick={onBack}>
            Volver
          </button>
        </div>
      </div>

      {children}
    </section>
  );
}