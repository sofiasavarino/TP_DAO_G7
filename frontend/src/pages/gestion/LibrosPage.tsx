import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminIcon from '../../components/admin/AdminIcon';
import LibroFormModal from '../../components/libros/LibroFormModal';
import { ApiError } from '../../services/api';
import { librosService } from '../../services/librosService';
import type { Libro, LibroListado } from '../../types/libros';
import { normalizar } from '../../utils/texto';

const POR_PAGINA = 15;

type Aviso = { tipo: 'ok' | 'error'; texto: string };
/** null = cerrado · 'nuevo' = alta · Libro = edición */
type Formulario = null | 'nuevo' | Libro;

function mensajeDeError(e: unknown, porDefecto: string): string {
  if (e instanceof ApiError) return e.message;
  return `${porDefecto} Verificá que el backend esté levantado.`;
}

/** F5.2 – Gestión del catálogo: listado con buscador interno, edición y baja lógica. */
export default function LibrosPage() {
  const [libros, setLibros] = useState<LibroListado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const [formulario, setFormulario] = useState<Formulario>(null);
  const [abriendoId, setAbriendoId] = useState<number | null>(null);
  const [aDarDeBaja, setADarDeBaja] = useState<LibroListado | null>(null);
  const [dandoDeBaja, setDandoDeBaja] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      setLibros(await librosService.listar());
    } catch (e) {
      setErrorCarga(mensajeDeError(e, 'No se pudo cargar el catálogo.'));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // El aviso se oculta solo
  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 4500);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return libros;
    const qIsbn = q.replace(/[-\s]/g, '');
    return libros.filter(
      (l) =>
        normalizar(l.nombre).includes(q) ||
        l.autores.some((a) => normalizar(a.nombre).includes(q)) ||
        normalizar(l.editorial).includes(q) ||
        normalizar(l.genero).includes(q) ||
        (qIsbn.length > 0 && (l.isbn ?? '').includes(qIsbn)),
    );
  }, [libros, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  useEffect(() => setPagina(1), [busqueda]);

  const abrirEdicion = async (libro: LibroListado) => {
    setAbriendoId(libro.id);
    try {
      setFormulario(await librosService.obtenerPorId(libro.id));
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, 'No se pudo abrir el libro.') });
    } finally {
      setAbriendoId(null);
    }
  };

  const alGuardar = (libro: Libro, eraEdicion: boolean) => {
    setFormulario(null);
    const yaEstaba = libros.some((l) => l.id === libro.id);
    setLibros((actual) => {
      const sinEse = actual.filter((l) => l.id !== libro.id);
      return [...sinEse, libro].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    });
    setAviso({
      tipo: 'ok',
      texto: eraEdicion
        ? `Se guardaron los cambios de "${libro.nombre}".`
        : yaEstaba
          ? `"${libro.nombre}" ya estaba en el catálogo con ese ISBN.`
          : `"${libro.nombre}" se agregó al catálogo.`,
    });
  };

  const confirmarBaja = async () => {
    if (!aDarDeBaja) return;
    setDandoDeBaja(true);
    try {
      await librosService.darDeBaja(aDarDeBaja.id);
      setLibros((actual) => actual.filter((l) => l.id !== aDarDeBaja.id));
      setAviso({ tipo: 'ok', texto: `"${aDarDeBaja.nombre}" se dio de baja del catálogo.` });
      setADarDeBaja(null);
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, 'No se pudo dar de baja el libro.') });
      setADarDeBaja(null);
    } finally {
      setDandoDeBaja(false);
    }
  };

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <span className="eyebrow">CATÁLOGO</span>
          <h1>
            Gestión de <em>libros</em>
          </h1>
          <p className="muted">
            {cargando ? 'Cargando catálogo…' : `${libros.length} títulos activos en la red de sedes.`}
          </p>
        </div>
        <button className="admin-primary" onClick={() => setFormulario('nuevo')}>
          <AdminIcon name="plus" size={18} />
          Nuevo libro
        </button>
      </div>

      {aviso && (
        <div className={`admin-aviso ${aviso.tipo}`} role={aviso.tipo === 'error' ? 'alert' : 'status'}>
          <AdminIcon name={aviso.tipo === 'ok' ? 'check' : 'close'} size={18} />
          <span>{aviso.texto}</span>
          <button onClick={() => setAviso(null)} aria-label="Cerrar aviso">
            <AdminIcon name="close" size={15} />
          </button>
        </div>
      )}

      <div className="admin-toolbar">
        <label className="admin-search">
          <AdminIcon name="search" size={18} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por título, autor, ISBN, editorial o género"
            aria-label="Buscar en el catálogo"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda">
              <AdminIcon name="close" size={15} />
            </button>
          )}
        </label>
        {busqueda && !cargando && (
          <span className="muted">
            {filtrados.length} {filtrados.length === 1 ? 'resultado' : 'resultados'}
          </span>
        )}
      </div>

      {errorCarga ? (
        <div className="admin-empty">
          <h3>No pudimos cargar el catálogo</h3>
          <p>{errorCarga}</p>
          <button className="ghost-btn" onClick={() => void cargar()}>
            Reintentar
          </button>
        </div>
      ) : cargando ? (
        <div className="admin-table-wrap">
          <div className="admin-skeleton" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="admin-empty">
          <h3>{busqueda ? 'Sin resultados' : 'El catálogo está vacío'}</h3>
          <p>
            {busqueda
              ? `No hay libros que coincidan con "${busqueda}".`
              : 'Agregá el primer libro buscándolo en Google Books.'}
          </p>
          <button className="ghost-btn" onClick={() => setFormulario('nuevo')}>
            Agregar libro
          </button>
        </div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Libro</th>
                  <th scope="col">Autores</th>
                  <th scope="col">ISBN</th>
                  <th scope="col">Género</th>
                  <th scope="col" className="acciones">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div className="admin-libro">
                        {l.imagen_url ? (
                          <img src={l.imagen_url} alt="" loading="lazy" />
                        ) : (
                          <span className="admin-cover-vacia" aria-hidden="true">
                            {l.nombre.charAt(0)}
                          </span>
                        )}
                        <div>
                          <strong>{l.nombre}</strong>
                          <small>{l.editorial ?? 'Editorial sin cargar'}</small>
                        </div>
                      </div>
                    </td>
                    <td>{l.autores.length ? l.autores.map((a) => a.nombre).join(', ') : <span className="muted">—</span>}</td>
                    <td className="mono">{l.isbn ?? <span className="muted">—</span>}</td>
                    <td>{l.genero ? <em className="badge">{l.genero}</em> : <span className="muted">—</span>}</td>
                    <td className="acciones">
                      <button
                        className="admin-icon-btn"
                        onClick={() => void abrirEdicion(l)}
                        disabled={abriendoId === l.id}
                        aria-label={`Editar ${l.nombre}`}
                        title="Editar"
                      >
                        <AdminIcon name="edit" size={17} />
                      </button>
                      <button
                        className="admin-icon-btn peligro"
                        onClick={() => setADarDeBaja(l)}
                        aria-label={`Dar de baja ${l.nombre}`}
                        title="Dar de baja"
                      >
                        <AdminIcon name="trash" size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="admin-paginacion">
              <button className="ghost-btn" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>
                ← Anterior
              </button>
              <span>
                Página {paginaActual} de {totalPaginas}
              </span>
              <button
                className="ghost-btn"
                disabled={paginaActual === totalPaginas}
                onClick={() => setPagina(paginaActual + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}

      {formulario && (
        <LibroFormModal
          libro={formulario === 'nuevo' ? null : formulario}
          librosExistentes={libros}
          onCerrar={() => setFormulario(null)}
          onGuardado={alGuardar}
          onEditarExistente={(l) => {
            setFormulario(null);
            void abrirEdicion(l);
          }}
        />
      )}

      {aDarDeBaja && (
        <div className="reservation-modal-backdrop" role="presentation">
          <section className="reservation-modal" role="dialog" aria-modal="true" aria-labelledby="baja-title">
            <button className="modal-close" onClick={() => setADarDeBaja(null)} aria-label="Cerrar">
              <AdminIcon name="close" size={18} />
            </button>
            <span className="eyebrow">DAR DE BAJA</span>
            <h2 id="baja-title">¿Quitar este libro del catálogo?</h2>
            <div className="modal-book">
              {aDarDeBaja.imagen_url && <img src={aDarDeBaja.imagen_url} alt="" />}
              <div>
                <strong>{aDarDeBaja.nombre}</strong>
                <span>{aDarDeBaja.autores.map((a) => a.nombre).join(', ')}</span>
              </div>
            </div>
            <p className="muted">
              Es una baja lógica: el libro deja de verse en el catálogo pero se conserva su historial. Si
              lo volvés a dar de alta con el mismo ISBN, se reactiva.
            </p>
            <div className="modal-actions">
              <button className="ghost-btn" style={{ width: '100%',marginTop: 0, borderRadius: 0, background:'#bc5a38'}} onClick={() => setADarDeBaja(null)}>
                Cancelar
              </button>
              <button className="confirm-reservation" style={{
                    width: '100%',
                    padding: '14px 18px',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 0,
                    background: '#e5e2dc',
                    color: '#3d433f',
                    border: '1px solid #c9c4ba',
                    cursor: 'pointer',
                  }} disabled={dandoDeBaja} onClick={() => void confirmarBaja()}>
                {dandoDeBaja ? 'DANDO DE BAJA…' : 'DAR DE BAJA'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
