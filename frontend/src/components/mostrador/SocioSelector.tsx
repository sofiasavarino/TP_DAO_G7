import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { esEndpointFaltante, mostradorService } from '../../services/mostradorService';
import type { SocioBusqueda } from '../../types/mostrador';
import AdminIcon from '../admin/AdminIcon';

/** Socio elegido: con datos si vino de la búsqueda, o solo el número si se cargó a mano. */
export interface SocioElegido {
  id: number;
  socio?: SocioBusqueda;
}

interface Props {
  value: SocioElegido | null;
  onChange: (socio: SocioElegido | null) => void;
  invalido?: boolean;
}

const MIN_CARACTERES = 2;

/**
 * Busca socios por nombre, apellido o DNI contra GET /api/v1/socios?q=.
 * Mientras ese endpoint no exista en el backend, cambia solo a "carga manual" del N° de socio.
 */
export default function SocioSelector({ value, onChange, invalido = false }: Props) {
  const listaId = useId();
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<SocioBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [manual, setManual] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  // Búsqueda con una pequeña espera para no pegarle al backend en cada tecla
  useEffect(() => {
    if (manual) return;
    const q = texto.trim();
    if (q.length < MIN_CARACTERES) {
      setResultados([]);
      return;
    }
    let vigente = true;
    const t = window.setTimeout(async () => {
      setBuscando(true);
      setErrorBusqueda(null);
      try {
        const lista = await mostradorService.buscarSocios(q);
        if (vigente) {
          setResultados(lista);
          setActivo(0);
        }
      } catch (e) {
        if (!vigente) return;
        if (esEndpointFaltante(e)) {
          setManual(true);
          setAbierto(false);
          setTexto('');
        } else {
          setErrorBusqueda('No se pudo buscar. Verificá que el backend esté levantado.');
        }
      } finally {
        if (vigente) setBuscando(false);
      }
    }, 300);
    return () => {
      vigente = false;
      window.clearTimeout(t);
    };
  }, [texto, manual]);

  const elegir = (s: SocioBusqueda) => {
    onChange({ id: s.id, socio: s });
    setTexto('');
    setAbierto(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAbierto(true);
      setActivo((i) => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && abierto && resultados[activo]) {
      e.preventDefault();
      elegir(resultados[activo]);
    } else if (e.key === 'Escape' && abierto) {
      e.stopPropagation();
      setAbierto(false);
    }
  };

  // Socio ya elegido: tarjeta con botón para cambiarlo
  if (value) {
    const s = value.socio;
    return (
      <div className="mos-socio-elegido">
        <span className="admin-avatar" aria-hidden="true">
          {s ? `${s.nombre.charAt(0)}${s.apellido.charAt(0)}`.toUpperCase() : '#'}
        </span>
        <div>
          <strong>{s ? `${s.apellido}, ${s.nombre}` : `Socio N° ${value.id}`}</strong>
          <small>{s ? `DNI ${s.dni}${s.email ? ` · ${s.email}` : ''}` : 'Cargado a mano por número de socio'}</small>
        </div>
        <button type="button" className="inv-limpiar" onClick={() => onChange(null)}>
          Cambiar
        </button>
      </div>
    );
  }

  if (manual) {
    return (
      <div className="mos-socio-manual">
        <label className={`admin-search${invalido ? ' mos-invalido' : ''}`}>
          <AdminIcon name="socios" size={17} />
          <input
            inputMode="numeric"
            value={texto}
            onChange={(e) => setTexto(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && texto) {
                e.preventDefault();
                onChange({ id: Number(texto) });
                setTexto('');
              }
            }}
            placeholder="N° de socio"
            aria-label="Número de socio"
          />
          <button
            type="button"
            className="inv-accion ok"
            disabled={!texto}
            onClick={() => {
              onChange({ id: Number(texto) });
              setTexto('');
            }}
          >
            Usar
          </button>
        </label>
        <small className="campo-ayuda">
          La búsqueda por nombre o DNI todavía no está disponible en el backend: cargá el número de socio.
        </small>
      </div>
    );
  }

  return (
    <div className={`libro-selector${invalido ? ' invalido' : ''}`}>
      <label className="admin-search">
        <AdminIcon name="socios" size={17} />
        <input
          role="combobox"
          aria-label="Buscar socio"
          aria-expanded={abierto}
          aria-controls={listaId}
          aria-autocomplete="list"
          value={texto}
          placeholder="Buscar socio por nombre, apellido o DNI"
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setAbierto(false)}
          onKeyDown={onKeyDown}
        />
      </label>
      {abierto && texto.trim().length >= MIN_CARACTERES && (
        <ul className="libro-selector-lista" id={listaId} role="listbox">
          {buscando ? (
            <li className="vacio">Buscando…</li>
          ) : errorBusqueda ? (
            <li className="vacio">{errorBusqueda}</li>
          ) : resultados.length === 0 ? (
            <li className="vacio">No hay socios que coincidan</li>
          ) : (
            resultados.map((s, i) => (
              <li
                key={s.id}
                role="option"
                aria-selected={i === activo}
                className={i === activo ? 'activo' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActivo(i)}
                onClick={() => elegir(s)}
              >
                <strong>
                  {s.apellido}, {s.nombre}
                </strong>
                <small>
                  DNI {s.dni} · N° {s.id}
                  {s.estado && s.estado !== 'ACTIVO' ? ` · ${s.estado}` : ''}
                </small>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
