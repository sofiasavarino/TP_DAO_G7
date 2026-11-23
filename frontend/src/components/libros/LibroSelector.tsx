import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { LibroListado } from '../../types/libros';
import { normalizar } from '../../utils/texto';
import AdminIcon from '../admin/AdminIcon';

interface Props {
  libros: LibroListado[];
  /** id del libro elegido o null */
  value: number | null;
  onChange: (libroId: number | null) => void;
  placeholder?: string;
  /** Muestra la cruz para volver a "todos" */
  limpiable?: boolean;
  invalido?: boolean;
  ariaLabel?: string;
}

const MAX_SUGERENCIAS = 8;

/** Combobox con búsqueda (título, autor o ISBN) para elegir un libro del catálogo. */
export default function LibroSelector({
  libros,
  value,
  onChange,
  placeholder = 'Buscar libro por título, autor o ISBN',
  limpiable = true,
  invalido = false,
  ariaLabel = 'Libro',
}: Props) {
  const listaId = useId();
  const elegido = libros.find((l) => l.id === value) ?? null;
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);

  const sugerencias = useMemo(() => {
    const q = normalizar(texto);
    const filtrados = q
      ? libros.filter(
          (l) =>
            normalizar(l.nombre).includes(q) ||
            l.autores.some((a) => normalizar(a.nombre).includes(q)) ||
            (l.isbn ?? '').includes(q.replace(/[-\s]/g, '')),
        )
      : libros;
    return filtrados.slice(0, MAX_SUGERENCIAS);
  }, [libros, texto]);

  const elegir = (l: LibroListado) => {
    onChange(l.id);
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
        <AdminIcon name="catalogo" size={17} />
        <input
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={abierto}
          aria-controls={listaId}
          aria-autocomplete="list"
          value={abierto || !elegido ? texto : elegido.nombre}
          placeholder={elegido ? elegido.nombre : placeholder}
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
        />
        {limpiable && elegido && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(null)}
            aria-label="Quitar libro elegido"
          >
            <AdminIcon name="close" size={15} />
          </button>
        )}
      </label>
      {abierto && (
        <ul className="libro-selector-lista" id={listaId} role="listbox">
          {sugerencias.length === 0 ? (
            <li className="vacio">No hay libros que coincidan</li>
          ) : (
            sugerencias.map((l, i) => (
              <li
                key={l.id}
                role="option"
                aria-selected={i === activo}
                className={i === activo ? 'activo' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActivo(i)}
                onClick={() => elegir(l)}
              >
                <strong>{l.nombre}</strong>
                <small>{l.autores.map((a) => a.nombre).join(', ') || 'Autor sin cargar'}</small>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
