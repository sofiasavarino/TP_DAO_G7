import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminIcon from '../../components/admin/AdminIcon';
import EjemplarAltaModal from '../../components/ejemplares/EjemplarAltaModal';
import LibroSelector from '../../components/libros/LibroSelector';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../services/api';
import { ejemplaresService, sedesService } from '../../services/ejemplaresService';
import { librosService } from '../../services/librosService';
import {
  ACCIONES_POR_ESTADO,
  ETIQUETA_ESTADO,
  MOTIVO_SIN_ACCIONES,
  type AccionEjemplar,
  type EjemplarInventario,
  type Sede,
} from '../../types/ejemplares';
import { EjemplarEstado, RolNombre } from '../../types/enums';
import type { LibroListado } from '../../types/libros';
import { normalizar } from '../../utils/texto';

const POR_PAGINA = 20;
const ESTADOS = Object.values(EjemplarEstado);

type Aviso = { tipo: 'ok' | 'error'; texto: string };

const BOTON_ACCION: Record<AccionEjemplar, { texto: string; clase: string }> = {
  reparacion: { texto: 'Enviar a reparación', clase: '' },
  reincorporacion: { texto: 'Reincorporar', clase: 'ok' },
  inutilizable: { texto: 'Inutilizable', clase: 'peligro' },
};

const AVISO_ACCION: Record<AccionEjemplar, string> = {
  reparacion: 'se envió a reparación',
  reincorporacion: 'volvió a estar disponible',
  inutilizable: 'quedó marcado como inutilizable',
};

function mensajeDeError(e: unknown, porDefecto: string): string {
  if (e instanceof ApiError) return e.message;
  return `${porDefecto} Verificá que el backend esté levantado.`;
}

/** F6 – Inventario físico: filtros por libro, sede y estado; alta de copias; cambios de estado. */
export default function EjemplaresPage() {
  const { usuario, rol } = useAuth();
  // El administrador gestiona toda la red; el bibliotecario solo el inventario de su sede
  const esAdmin = rol === RolNombre.ADMINISTRADOR;

  const [libros, setLibros] = useState<LibroListado[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [ejemplares, setEjemplares] = useState<EjemplarInventario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  // Filtros: libro y sede van al backend; estado y texto se aplican acá (así los
  // contadores por estado siempre reflejan el libro/sede elegidos).
  const [libroId, setLibroId] = useState<number | null>(null);
  const [sedeId, setSedeId] = useState<number | null>(usuario?.sede.id ?? null);
  const [estado, setEstado] = useState<EjemplarEstado | null>(null);
  const [codigo, setCodigo] = useState('');
  const [pagina, setPagina] = useState(1);

  const [altaAbierta, setAltaAbierta] = useState(false);
  const [procesando, setProcesando] = useState<number | null>(null);
  const [aInutilizar, setAInutilizar] = useState<EjemplarInventario | null>(null);

  // Por defecto se muestra la sede del usuario (puede llegar después del primer render)
  const sedeUsuario = usuario?.sede.id ?? null;
  const [sedeInicializada, setSedeInicializada] = useState(sedeUsuario !== null);
  useEffect(() => {
    if (!sedeInicializada && sedeUsuario !== null) {
      setSedeId(sedeUsuario);
      setSedeInicializada(true);
    }
  }, [sedeInicializada, sedeUsuario]);

  // Libros y sedes para los selectores (una sola vez)
  useEffect(() => {
    Promise.all([librosService.listar(), sedesService.listar()])
      .then(([l, s]) => {
        setLibros(l);
        setSedes(s);
      })
      .catch((e) => setErrorCarga(mensajeDeError(e, 'No se pudieron cargar libros y sedes.')));
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      setEjemplares(
        await ejemplaresService.listar({ libro_id: libroId ?? undefined, sede_id: sedeId ?? undefined }),
      );
    } catch (e) {
      setErrorCarga(mensajeDeError(e, 'No se pudo cargar el inventario.'));
    } finally {
      setCargando(false);
    }
  }, [libroId, sedeId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 4500);
    return () => window.clearTimeout(t);
  }, [aviso]);

  useEffect(() => setPagina(1), [libroId, sedeId, estado, codigo]);

  const conteo = useMemo(() => {
    const c = Object.fromEntries(ESTADOS.map((e) => [e, 0])) as Record<EjemplarEstado, number>;
    for (const e of ejemplares) c[e.estado] += 1;
    return c;
  }, [ejemplares]);

  const filtrados = useMemo(() => {
    const q = normalizar(codigo);
    return ejemplares.filter(
      (e) =>
        (!estado || e.estado === estado) &&
        (!q ||
          normalizar(e.codigo_inventario).includes(q) ||
          normalizar(e.signatura_topografica).includes(q) ||
          normalizar(e.libro.nombre).includes(q)),
    );
  }, [ejemplares, estado, codigo]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  const puedeGestionar = (ej: EjemplarInventario) => esAdmin || ej.sede_actual_id === sedeUsuario;

  const reemplazar = (actualizado: EjemplarInventario) =>
    setEjemplares((lista) => lista.map((e) => (e.id === actualizado.id ? actualizado : e)));

  const ejecutar = async (ej: EjemplarInventario, accion: AccionEjemplar) => {
    setProcesando(ej.id);
    try {
      const actualizado = await ejemplaresService.aplicarAccion(ej.id, accion);
      reemplazar(actualizado);
      setAviso({ tipo: 'ok', texto: `El ejemplar ${ej.codigo_inventario} ${AVISO_ACCION[accion]}.` });
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, 'No se pudo cambiar el estado.') });
      void cargar(); // por si otro usuario lo cambió mientras tanto
    } finally {
      setProcesando(null);
      setAInutilizar(null);
    }
  };

  const alCrear = (creados: EjemplarInventario[]) => {
    setAltaAbierta(false);
    const visiblesConFiltro = creados.filter(
      (e) => (!libroId || e.libro_id === libroId) && (!sedeId || e.sede_actual_id === sedeId),
    );
    setEjemplares((lista) =>
      [...lista, ...visiblesConFiltro].sort(
        (a, b) =>
          a.libro.nombre.localeCompare(b.libro.nombre, 'es') ||
          a.codigo_inventario.localeCompare(b.codigo_inventario, 'es', { numeric: true }),
      ),
    );
    const primero = creados[0];
    setAviso({
      tipo: 'ok',
      texto:
        creados.length === 1
          ? `Se registró el ejemplar ${primero?.codigo_inventario} de "${primero?.libro.nombre}" en ${primero?.sede_actual.nombre}.`
          : `Se registraron ${creados.length} ejemplares de "${primero?.libro.nombre}" en ${primero?.sede_actual.nombre}.`,
    });
  };

  const hayFiltros = libroId !== null || estado !== null || codigo !== '' || sedeId !== sedeUsuario;
  const limpiarFiltros = () => {
    setLibroId(null);
    setSedeId(sedeUsuario);
    setEstado(null);
    setCodigo('');
  };
  const nombreSede = sedes.find((s) => s.id === sedeId)?.nombre;

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <span className="eyebrow">INVENTARIO FÍSICO</span>
          <h1>
            Ejemplares y <em>stock</em>
          </h1>
          <p className="muted">
            {cargando
              ? 'Cargando inventario…'
              : `${ejemplares.length} ${ejemplares.length === 1 ? 'copia' : 'copias'} ${
                  nombreSede ? `en ${nombreSede}` : 'en toda la red'
                } · ${conteo[EjemplarEstado.DISPONIBLE]} disponibles`}
          </p>
        </div>
        <button className="admin-primary" onClick={() => setAltaAbierta(true)} disabled={!libros.length || !sedes.length}>
          <AdminIcon name="plus" size={18} />
          Agregar ejemplares
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

      {/* --- Filtros (F6.1) --- */}
      <div className="inv-filtros">
        <LibroSelector
          libros={libros}
          value={libroId}
          onChange={setLibroId}
          placeholder="Todos los libros"
          ariaLabel="Filtrar por libro"
        />
        <label className="inv-select">
          <span className="sr-only">Filtrar por sede</span>
          <select value={sedeId ?? ''} onChange={(e) => setSedeId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Todas las sedes</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
                {s.id === usuario?.sede.id ? ' (mi sede)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-search inv-codigo">
          <AdminIcon name="search" size={17} />
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código o signatura"
            aria-label="Buscar por código de inventario o signatura"
          />
        </label>
        {hayFiltros && (
          <button className="inv-limpiar" onClick={limpiarFiltros}>
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="inv-estados" role="group" aria-label="Filtrar por estado">
        <button className={estado === null ? 'activo' : ''} onClick={() => setEstado(null)} aria-pressed={estado === null}>
          Todos <b>{ejemplares.length}</b>
        </button>
        {ESTADOS.map((e) => (
          <button
            key={e}
            className={`${estado === e ? 'activo ' : ''}est-${e.toLowerCase()}`}
            onClick={() => setEstado(estado === e ? null : e)}
            aria-pressed={estado === e}
          >
            <i aria-hidden="true" />
            {ETIQUETA_ESTADO[e]} <b>{conteo[e]}</b>
          </button>
        ))}
      </div>

      {/* --- Tabla --- */}
      {errorCarga ? (
        <div className="admin-empty">
          <h3>No pudimos cargar el inventario</h3>
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
          <h3>{ejemplares.length ? 'Sin resultados' : 'No hay ejemplares'}</h3>
          <p>
            {ejemplares.length
              ? 'Ningún ejemplar coincide con los filtros elegidos.'
              : 'Todavía no hay copias registradas para este libro o sede.'}
          </p>
          {ejemplares.length ? (
            <button className="ghost-btn" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          ) : (
            <button className="ghost-btn" onClick={() => setAltaAbierta(true)}>
              Agregar ejemplares
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table inv-tabla">
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Libro</th>
                  <th scope="col">Sede actual</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="acciones">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((ej) => {
                  const acciones = ACCIONES_POR_ESTADO[ej.estado];
                  const deOtraSede = acciones.length > 0 && !puedeGestionar(ej);
                  const ocupado = procesando === ej.id;
                  return (
                    <tr key={ej.id} className={ej.estado === EjemplarEstado.INUTILIZABLE ? 'inv-baja' : ''}>
                      <td>
                        <strong className="mono">{ej.codigo_inventario}</strong>
                        {ej.signatura_topografica && <small className="inv-sub">{ej.signatura_topografica}</small>}
                      </td>
                      <td>
                        <strong>{ej.libro.nombre}</strong>
                        {ej.descripcion_fisica && <small className="inv-sub">{ej.descripcion_fisica}</small>}
                      </td>
                      <td>
                        {ej.sede_actual.nombre}
                        {ej.sede_origen_id !== ej.sede_actual_id && (
                          <small className="inv-sub">Origen: {ej.sede_origen.nombre}</small>
                        )}
                      </td>
                      <td>
                        <span className={`estado-pill est-${ej.estado.toLowerCase()}`}>
                          <i aria-hidden="true" />
                          {ETIQUETA_ESTADO[ej.estado]}
                        </span>
                      </td>
                      <td className="acciones">
                        {deOtraSede ? (
                          <small className="muted">Lo gestiona {ej.sede_actual.nombre}</small>
                        ) : acciones.length ? (
                          <div className="inv-acciones">
                            {acciones.map((a) => (
                              <button
                                key={a}
                                className={`inv-accion ${BOTON_ACCION[a].clase}`}
                                disabled={ocupado}
                                onClick={() => (a === 'inutilizable' ? setAInutilizar(ej) : void ejecutar(ej, a))}
                              >
                                {BOTON_ACCION[a].texto}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <small className="muted">{MOTIVO_SIN_ACCIONES[ej.estado]}</small>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="admin-paginacion">
              <button className="ghost-btn" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>
                ← Anterior
              </button>
              <span>
                Página {paginaActual} de {totalPaginas} · {filtrados.length} copias
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

      {altaAbierta && (
        <EjemplarAltaModal
          libros={libros}
          sedes={sedes}
          libroInicial={libroId}
          sedeInicial={sedeId ?? sedeUsuario}
          sedeFija={esAdmin ? null : sedeUsuario}
          onCerrar={() => setAltaAbierta(false)}
          onCreados={alCrear}
        />
      )}

      {/* --- Confirmación de INUTILIZABLE (F6.3, estado terminal) --- */}
      {aInutilizar && (
        <div className="reservation-modal-backdrop" role="presentation">
          <section className="reservation-modal" role="dialog" aria-modal="true" aria-labelledby="inut-title">
            <button className="modal-close" onClick={() => setAInutilizar(null)} aria-label="Cerrar">
              <AdminIcon name="close" size={18} />
            </button>
            <span className="eyebrow">DAR DE BAJA EJEMPLAR</span>
            <h2 id="inut-title">¿Marcar como inutilizable?</h2>
            <div className="modal-book">
              {aInutilizar.libro.imagen_url && <img src={aInutilizar.libro.imagen_url} alt="" />}
              <div>
                <strong>{aInutilizar.libro.nombre}</strong>
                <span>
                  {aInutilizar.codigo_inventario} · {aInutilizar.sede_actual.nombre} ·{' '}
                  {ETIQUETA_ESTADO[aInutilizar.estado]}
                </span>
              </div>
            </div>
            <p className="fine-alert">
              Es un estado final: la copia sale de circulación para siempre y no se puede volver a
              disponible. Se conserva en el historial.
            </p>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setAInutilizar(null)}>
                Cancelar
              </button>
              <button
                className="confirm-reservation"
                disabled={procesando === aInutilizar.id}
                onClick={() => void ejecutar(aInutilizar, 'inutilizable')}
              >
                {procesando === aInutilizar.id ? 'MARCANDO…' : 'MARCAR INUTILIZABLE'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
