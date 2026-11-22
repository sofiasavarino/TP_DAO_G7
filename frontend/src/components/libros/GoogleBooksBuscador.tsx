import { useState, type FormEvent } from 'react';
import { ApiError } from '../../services/api';
import { librosService } from '../../services/librosService';
import type { LibroGoogle } from '../../types/libros';
import { anio, limpiarIsbn } from '../../utils/texto';
import AdminIcon from '../admin/AdminIcon';

interface Props {
  /** ISBNs (sin guiones) que ya están en el catálogo, para marcar duplicados. */
  isbnsEnCatalogo: Set<string>;
  onSeleccionar: (resultado: LibroGoogle) => void;
  /** Texto inicial (p. ej. el título del libro que se está editando). */
  consultaInicial?: string;
}

/**
 * F5.3 – Buscador conectado al proxy del backend (GET /api/v1/libros/google),
 * que a su vez consulta Google Books con la API key del servidor.
 */
export default function GoogleBooksBuscador({ isbnsEnCatalogo, onSeleccionar, consultaInicial = '' }: Props) {
  const [consulta, setConsulta] = useState(consultaInicial);
  const [resultados, setResultados] = useState<LibroGoogle[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elegido, setElegido] = useState<number | null>(null);

  const buscar = async (e: FormEvent) => {
    e.preventDefault();
    const q = consulta.trim();
    if (q.length < 2) {
      setError('Escribí al menos 2 caracteres.');
      return;
    }
    setBuscando(true);
    setError(null);
    setElegido(null);
    try {
      setResultados(await librosService.buscarEnGoogle(q));
    } catch (err) {
      setResultados(null);
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo conectar con el servidor. Verificá que el backend esté levantado.',
      );
    } finally {
      setBuscando(false);
    }
  };

  return (
    <section className="gb-buscador" aria-labelledby="gb-titulo">
      <div className="gb-head">
        <AdminIcon name="globe" size={18} />
        <h3 id="gb-titulo">Buscar en Google Books</h3>
        <small>Elegí un resultado para completar el formulario</small>
      </div>

      <form className="gb-form" onSubmit={buscar} role="search">
        <label className="admin-search">
          <AdminIcon name="search" size={18} />
          <input
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Título, autor o ISBN (ej. Rayuela Cortázar)"
            aria-label="Buscar en Google Books"
            autoFocus
          />
        </label>
        <button className="admin-primary" type="submit" disabled={buscando}>
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {error && (
        <p className="gb-error" role="alert">
          {error}
        </p>
      )}

      {resultados && !error && (
        <div className="gb-resultados" aria-live="polite">
          {resultados.length === 0 ? (
            <p className="muted">Google Books no devolvió resultados. Probá con otras palabras o cargalo a mano.</p>
          ) : (
            <>
              <p className="gb-cuenta">
                {resultados.length} {resultados.length === 1 ? 'resultado' : 'resultados'}
              </p>
              <ul>
                {resultados.map((r, i) => {
                  const isbn = limpiarIsbn(r.isbn);
                  const duplicado = isbn !== null && isbnsEnCatalogo.has(isbn);
                  return (
                    <li key={`${r.isbn ?? r.nombre}-${i}`} className={elegido === i ? 'elegido' : ''}>
                      {r.imagen_url ? (
                        <img src={r.imagen_url} alt="" loading="lazy" />
                      ) : (
                        <span className="admin-cover-vacia" aria-hidden="true">
                          {(r.nombre ?? '?').charAt(0)}
                        </span>
                      )}
                      <div className="gb-info">
                        <strong>{r.nombre}</strong>
                        <span>{r.autores.length ? r.autores.join(', ') : 'Autor desconocido'}</span>
                        <small>
                          {[r.editorial, anio(r.fecha_publicacion)].filter(Boolean).join(' · ')}
                          {r.isbn && <> · ISBN {r.isbn}</>}
                        </small>
                        {duplicado && <em className="badge">Ya está en el catálogo</em>}
                        {!r.isbn && <em className="badge">Sin ISBN</em>}
                      </div>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => {
                          setElegido(i);
                          onSeleccionar(r);
                        }}
                      >
                        {elegido === i ? 'Elegido' : 'Usar datos'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
