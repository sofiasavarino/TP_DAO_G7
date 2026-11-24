import { useEffect, useMemo, useRef, useState } from 'react';
import Estante from '../../components/socio/Estante';
import Icon from '../../components/socio/Icon';
import LibroCard from '../../components/socio/LibroCard';
import Portada from '../../components/socio/Portada';
import type { Sede } from '../../types/ejemplares';
import type { LibroListado } from '../../types/libros';
import { copiasEnSede, sedesConCopias, totalCopias, type Disponibilidad } from '../../utils/disponibilidad';
import { nombresAutores } from '../../utils/libros';
import { limpiarIsbn, normalizar } from '../../utils/texto';

/** default / populares / recientes los ordena el backend; autor se ordena acá. */
export type OrdenCatalogo = 'default' | 'populares' | 'recientes' | 'autor';

const TODOS_GENEROS = 'Todos los géneros';
const TODOS_AUTORES = 'Todos los autores';

interface Props {
  libros: LibroListado[];
  sedes: Sede[];
  disponibilidad: Disponibilidad;
  cargando: boolean;
  error: string | null;
  onReintentar: () => void;
  /** Texto de la barra de búsqueda del header (título, autor o ISBN) */
  query: string;
  orden: OrdenCatalogo;
  onOrden: (orden: OrdenCatalogo) => void;
  /** Sede del socio (para el estante "Disponibles en tu sede") */
  sedePropia: { id: number; nombre: string } | null;
  reservados: Set<number>;
  onOpen: (libro: LibroListado) => void;
  onReserve: (libro: LibroListado) => void;
}

/** ¿El libro coincide con la búsqueda por título, autor o ISBN? (sin tildes ni guiones) */
export function coincideBusqueda(libro: LibroListado, query: string): boolean {
  const q = normalizar(query);
  if (!q) return true;
  const isbnQ = limpiarIsbn(query);
  return (
    normalizar(libro.nombre).includes(q) ||
    libro.autores.some((a) => normalizar(a.nombre).includes(q)) ||
    (!!isbnQ && !!libro.isbn && libro.isbn.toUpperCase().includes(isbnQ))
  );
}

/** F3 – Catálogo del portal de socios con datos reales y disponibilidad por sede. */
export default function CatalogoPage({
  libros,
  sedes,
  disponibilidad,
  cargando,
  error,
  onReintentar,
  query,
  orden,
  onOrden,
  sedePropia,
  reservados,
  onOpen,
  onReserve,
}: Props) {
  const [genero, setGenero] = useState(TODOS_GENEROS);
  const [autor, setAutor] = useState(TODOS_AUTORES);
  const [autorBusqueda, setAutorBusqueda] = useState('');
  const [autorAbierto, setAutorAbierto] = useState(false);
  const [sedesElegidas, setSedesElegidas] = useState<number[]>([]);
  const [sedesAbierto, setSedesAbierto] = useState(false);
  const sedesRef = useRef<HTMLDivElement>(null);

  // Click fuera del desplegable de sedes lo cierra
  useEffect(() => {
    if (!sedesAbierto) return;
    const cerrar = (e: MouseEvent) => {
      if (!sedesRef.current?.contains(e.target as Node)) setSedesAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [sedesAbierto]);

  const generos = useMemo(
    () => [
      TODOS_GENEROS,
      ...Array.from(new Set(libros.map((l) => l.genero).filter((g): g is string => !!g))).sort((a, b) =>
        a.localeCompare(b, 'es'),
      ),
    ],
    [libros],
  );
  const autores = useMemo(
    () => [
      TODOS_AUTORES,
      ...Array.from(new Set(libros.flatMap((l) => l.autores.map((a) => a.nombre)))).sort((a, b) =>
        a.localeCompare(b, 'es'),
      ),
    ],
    [libros],
  );
  const autoresSugeridos = autores.filter((nombre) => {
    if (!autorBusqueda || nombre === TODOS_AUTORES) return true;
    const destino = normalizar(nombre);
    const busqueda = normalizar(autorBusqueda);
    if (destino.includes(busqueda)) return true;
    // Tolerancia a un error de tipeo al final ("borjes" → "Borges")
    return busqueda.length > 2 && destino.split(' ').some((p) => p.startsWith(busqueda.slice(0, -1)));
  });

  const hayFiltros =
    !!query.trim() ||
    genero !== TODOS_GENEROS ||
    autor !== TODOS_AUTORES ||
    orden !== 'default' ||
    sedesElegidas.length > 0;

  const resultados = useMemo(() => {
    const filtrados = libros.filter(
      (l) =>
        coincideBusqueda(l, query) &&
        (genero === TODOS_GENEROS || l.genero === genero) &&
        (autor === TODOS_AUTORES || l.autores.some((a) => a.nombre === autor)) &&
        (!sedesElegidas.length || sedesElegidas.some((id) => copiasEnSede(disponibilidad, l.id, id) > 0)),
    );
    if (orden !== 'autor') return filtrados; // el backend ya los mandó ordenados
    return [...filtrados].sort(
      (x, y) =>
        nombresAutores(x).localeCompare(nombresAutores(y), 'es') || x.nombre.localeCompare(y.nombre, 'es'),
    );
  }, [libros, query, genero, autor, sedesElegidas, orden, disponibilidad]);

  const limpiarFiltros = () => {
    setGenero(TODOS_GENEROS);
    setAutor(TODOS_AUTORES);
    setAutorBusqueda('');
    setSedesElegidas([]);
    onOrden('default');
  };
  const toggleSede = (id: number) =>
    setSedesElegidas((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  // ----- Portada del catálogo (sin filtros): destacado + estantes armados con datos reales
  const destacado = libros.find((l) => l.imagen_url && totalCopias(disponibilidad, l.id) > 0) ??
    libros.find((l) => totalCopias(disponibilidad, l.id) > 0);
  const enMiSede = sedePropia ? libros.filter((l) => copiasEnSede(disponibilidad, l.id, sedePropia.id) > 0) : [];
  const estantesPorGenero = useMemo(() => {
    const porGenero = new Map<string, LibroListado[]>();
    libros.forEach((l) => l.genero && porGenero.set(l.genero, [...(porGenero.get(l.genero) ?? []), l]));
    return [...porGenero.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 3);
  }, [libros]);

  const totalDisponibles = libros.reduce((s, l) => s + totalCopias(disponibilidad, l.id), 0);
  const tarjeta = { sedes, disponibilidad, reservados, onOpen, onReserve };

  return (
    <>
      <section className="intro">
        <div>
          <span className="eyebrow">CATÁLOGO DE LA BIBLIOTECA</span>
          <h1>
            Tu próxima historia
            <br />
            empieza <em>aquí.</em>
          </h1>
        </div>
        <p>
          {cargando && !libros.length
            ? 'Cargando el catálogo…'
            : `Explorá, reservá y disfrutá. ${libros.length} ${libros.length === 1 ? 'título' : 'títulos'} y ${totalDisponibles} ${
                totalDisponibles === 1 ? 'copia disponible' : 'copias disponibles'
              } en ${sedes.length} ${sedes.length === 1 ? 'sede' : 'sedes'}.`}
        </p>
      </section>

      <section className="filters" aria-label="Filtros del catálogo">
        <span className="filter-label">Filtrar por</span>
        <label>
          <span>Género</span>
          <select value={genero} onChange={(e) => setGenero(e.target.value)}>
            {generos.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <Icon name="chevron" size={17} />
        </label>
        <div className="filter-control author-filter">
          <span>Autor</span>
          <input
            value={autorAbierto ? autorBusqueda : autor}
            onChange={(e) => {
              setAutorBusqueda(e.target.value);
              setAutorAbierto(true);
            }}
            onFocus={() => {
              setAutorBusqueda(autor === TODOS_AUTORES ? '' : autor);
              setAutorAbierto(true);
              setSedesAbierto(false);
            }}
            onBlur={() => window.setTimeout(() => setAutorAbierto(false), 150)}
            placeholder="Buscar autor"
            aria-label="Buscar autor"
          />
          <Icon name="chevron" size={17} />
          {autorAbierto && (
            <div className="filter-dropdown author-options">
              {autoresSugeridos.length ? (
                autoresSugeridos.map((nombre) => (
                  <button
                    key={nombre}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setAutor(nombre);
                      setAutorBusqueda('');
                      setAutorAbierto(false);
                    }}
                  >
                    {nombre}
                  </button>
                ))
              ) : (
                <p>No encontramos autores parecidos.</p>
              )}
            </div>
          )}
        </div>

        <div className="filter-control branch-filter" ref={sedesRef}>
          <span>Disponible en</span>
          <button
            className="filter-trigger"
            onClick={() => {
              setSedesAbierto(!sedesAbierto);
              setAutorAbierto(false);
            }}
          >
            {sedesElegidas.length
              ? `${sedesElegidas.length} ${sedesElegidas.length === 1 ? 'sede' : 'sedes'}`
              : 'Todas las sedes'}
          </button>
          <Icon name="chevron" size={17} />
          {sedesAbierto && (
            <div className="filter-dropdown branch-options">
              {sedes.map((sede) => (
                <label key={sede.id}>
                  <input
                    type="checkbox"
                    checked={sedesElegidas.includes(sede.id)}
                    onChange={() => toggleSede(sede.id)}
                  />
                  <span className="checkmark" />
                  {sede.nombre}
                </label>
              ))}
            </div>
          )}
        </div>

        <span className="filter-label" style={{ marginLeft: 'auto' }}>Ordenar por</span>
          <label>
            <span>Criterio</span>
            <select value={orden} onChange={(e) => onOrden(e.target.value as OrdenCatalogo)}>
              <option value="default">Relevancia</option>
              <option value="populares">Más prestados</option>
              <option value="recientes">Más recientes</option>
              <option value="autor">Autor (A–Z)</option>
            </select>
            <Icon name="chevron" size={17} />
          </label>

        {hayFiltros && (
          <button className="clear-filters" onClick={limpiarFiltros}>
            Limpiar
          </button>
        )}
        
      </section>

      {error ? (
        <div className="empty">
          <Icon name="book" size={32} />
          <h3>No pudimos cargar el catálogo</h3>
          <p>{error}</p>
          <button onClick={onReintentar}>Reintentar</button>
        </div>
      ) : cargando && !libros.length ? (
        <div className="empty">
          <Icon name="book" size={32} />
          <h3>Cargando libros…</h3>
        </div>
      ) : !libros.length ? (
        <div className="empty">
          <Icon name="book" size={32} />
          <h3>Todavía no hay libros en el catálogo</h3>
          <p>Cuando la biblioteca cargue títulos los vas a ver acá.</p>
        </div>
      ) : hayFiltros ? (
        <section className="results">
          <div className="section-heading">
            <div>
              <span>RESULTADOS</span>
              <h2>
                {resultados.length} {resultados.length === 1 ? 'libro encontrado' : 'libros encontrados'}
              </h2>
            </div>
          </div>
          {resultados.length ? (
            <div className="results-grid">
              {resultados.map((libro) => (
                <LibroCard
                  key={libro.id}
                  libro={libro}
                  sedes={sedes}
                  disponibilidad={disponibilidad}
                  reservado={reservados.has(libro.id)}
                  onOpen={onOpen}
                  onReserve={onReserve}
                />
              ))}
            </div>
          ) : (
            <div className="empty">
              <Icon name="search" size={32} />
              <h3>No encontramos coincidencias</h3>
              <p>Probá con otro título, autor o ISBN, o cambiá los filtros.</p>
            </div>
          )}
        </section>
      ) : (
        <>
          {destacado && (
            <section className="weekly">
              <div className="weekly-image">
                <Portada src={destacado.imagen_url} titulo={destacado.nombre} />
                <span>DESTACADO DEL CATÁLOGO</span>
              </div>
              <div className="weekly-copy">
                <span className="eyebrow">PARA LEER AHORA</span>
                <h2>{destacado.nombre}</h2>
                <p className="author">
                  {nombresAutores(destacado)}
                  {destacado.genero && ` · ${destacado.genero}`}
                </p>
                <p className="synopsis">
                  {[destacado.editorial, destacado.isbn && `ISBN ${destacado.isbn}`].filter(Boolean).join(' · ')}
                </p>
                <div className="weekly-meta">
                  <span>
                    Disponible en{' '}
                    <b>
                      {sedesConCopias(disponibilidad, destacado.id, sedes)
                        .map(({ sede, copias }) => `${sede.nombre} (${copias})`)
                        .join(', ')}
                    </b>
                  </span>
                </div>
                <button disabled={reservados.has(destacado.id)} onClick={() => onReserve(destacado)}>
                  {reservados.has(destacado.id) ? 'Ya lo reservaste' : 'Reservar este libro'} <Icon name="arrow" />
                </button>
              </div>
              <div className="weekly-number">01</div>
            </section>
          )}

          {sedePropia && enMiSede.length > 0 && (
            <Estante titulo={`Disponibles en ${sedePropia.nombre}`} kicker="PARA RETIRAR HOY" libros={enMiSede} {...tarjeta} />
          )}
          {estantesPorGenero.map(([nombreGenero, lista]) => (
            <Estante key={nombreGenero} titulo={nombreGenero} kicker="POR GÉNERO" libros={lista} {...tarjeta} />
          ))}
          <Estante titulo="Todo el catálogo" kicker="EXPLORAR" libros={libros} {...tarjeta} />
        </>
      )}
    </>
  );
}
