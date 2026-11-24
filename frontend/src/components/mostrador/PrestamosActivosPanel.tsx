import { useCallback, useEffect, useMemo, useState } from 'react';
import { mostradorService } from '../../services/mostradorService';
import type { EjemplarInventario } from '../../types/ejemplares';
import { PrestamoEstado, PrestamoTipo } from '../../types/enums';
import {
  ETIQUETA_ESTADO_PRESTAMO,
  ETIQUETA_TIPO_PRESTAMO,
  type PrestamoListado,
} from '../../types/mostrador';
import { diasHasta, formatearFecha, textoVencimiento } from '../../utils/fechas';
import { normalizar } from '../../utils/texto';
import AdminIcon from '../admin/AdminIcon';
import { mensajeDeError, type Aviso } from './avisos';

interface Props {
  sedeId: number;
  sedeNombre: string;
  usuarioId: number;
  ejemplares: EjemplarInventario[];
  version: number;
  onAviso: (aviso: Aviso) => void;
  onCambio: () => void;
  onConteo: (n: number | null) => void;
}

const POR_PAGINA = 20;
type FiltroEstado = 'todos' | 'al_dia' | 'atrasados';

/** Préstamo con los datos del ejemplar (libro, sede) cruzados desde el inventario. */
interface PrestamoVista extends PrestamoListado {
  ejemplar?: EjemplarInventario;
  dias: number;
  atrasado: boolean;
}

/**
 * F7.3 – Préstamos en curso (ACTIVO y VENCIDO) con buscador por socio o código de
 * ejemplar, y "Registrar devolución" en la sede del mostrador (inventario flotante:
 * el ejemplar queda donde se devuelve).
 */
export default function PrestamosActivosPanel({
  sedeId,
  sedeNombre,
  usuarioId,
  ejemplares,
  version,
  onAviso,
  onCambio,
  onConteo,
}: Props) {
  const [prestamos, setPrestamos] = useState<PrestamoListado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroEstado>('todos');
  const [pagina, setPagina] = useState(1);
  const [aDevolver, setADevolver] = useState<PrestamoVista | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const enCurso = (await mostradorService.listarPrestamos()).filter(
        (p) => p.estado === PrestamoEstado.ACTIVO || p.estado === PrestamoEstado.VENCIDO,
      );
      // Primero los que vencen antes (los atrasados quedan arriba)
      enCurso.sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
      setPrestamos(enCurso);
      onConteo(enCurso.length);
    } catch (e) {
      onConteo(null);
      setError(mensajeDeError(e, 'No se pudieron cargar los préstamos.'));
    } finally {
      setCargando(false);
    }
  }, [onConteo]);

  useEffect(() => {
    void cargar();
  }, [cargar, version]);

  useEffect(() => setPagina(1), [busqueda, filtro]);

  const vistas: PrestamoVista[] = useMemo(() => {
    const porId = new Map(ejemplares.map((e) => [e.id, e]));
    return prestamos.map((p) => {
      const dias = diasHasta(p.fecha_vencimiento);
      // VENCIDO lo marca el backend; un ACTIVO con la fecha pasada también está atrasado
      return { ...p, ejemplar: porId.get(p.ejemplar_id), dias, atrasado: p.estado === PrestamoEstado.VENCIDO || dias < 0 };
    });
  }, [prestamos, ejemplares]);

  const conteo = useMemo(
    () => ({
      todos: vistas.length,
      al_dia: vistas.filter((p) => !p.atrasado).length,
      atrasados: vistas.filter((p) => p.atrasado).length,
    }),
    [vistas],
  );

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    return vistas.filter(
      (p) =>
        (filtro === 'todos' || (filtro === 'atrasados') === p.atrasado) &&
        (!q ||
          normalizar(p.socio_nombre).includes(q) ||
          String(p.socio_id) === q ||
          normalizar(p.ejemplar_codigo).includes(q) ||
          normalizar(p.numero).includes(q) ||
          normalizar(p.ejemplar?.libro.nombre).includes(q) ||
          (p.tipo === PrestamoTipo.INTERBIBLIOTECARIO && normalizar(p.ejemplar?.sede_origen.nombre).includes(q))),
    );
  }, [vistas, busqueda, filtro]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  const alDevolver = (prestamoId: number, texto: string) => {
    setADevolver(null);
    const restantes = prestamos.filter((p) => p.id !== prestamoId);
    setPrestamos(restantes);
    onConteo(restantes.length);
    onAviso({ tipo: 'ok', texto });
    onCambio();
  };

  const FILTROS: { id: FiltroEstado; texto: string; clase: string }[] = [
    { id: 'todos', texto: 'Todos', clase: '' },
    { id: 'al_dia', texto: 'Al día', clase: 'est-activo' },
    { id: 'atrasados', texto: 'Atrasados', clase: 'est-vencido' },
  ];

  return (
    <>
      <div className="inv-filtros">
        <label className="admin-search">
          <AdminIcon name="search" size={17} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Socio, N° de socio, código de ejemplar o N° de préstamo"
            aria-label="Buscar préstamo"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} aria-label="Borrar búsqueda">
              <AdminIcon name="close" size={15} />
            </button>
          )}
        </label>
      </div>

      <div className="inv-estados" role="group" aria-label="Filtrar por situación">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            className={`${filtro === f.id ? 'activo ' : ''}${f.clase}`}
            onClick={() => setFiltro(f.id)}
            aria-pressed={filtro === f.id}
          >
            {f.clase && <i aria-hidden="true" />}
            {f.texto} <b>{conteo[f.id]}</b>
          </button>
        ))}
      </div>

      {error ? (
        <div className="admin-empty">
          <h3>No pudimos cargar los préstamos</h3>
          <p>{error}</p>
          <button className="ghost-btn" onClick={() => void cargar()}>
            Reintentar
          </button>
        </div>
      ) : cargando ? (
        <div className="admin-table-wrap">
          <div className="admin-skeleton" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="admin-empty">
          <h3>{prestamos.length ? 'Sin resultados' : 'No hay préstamos en curso'}</h3>
          <p>
            {prestamos.length
              ? 'Ningún préstamo coincide con la búsqueda.'
              : 'Los préstamos activos y vencidos de la red aparecen acá.'}
          </p>
        </div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table inv-tabla mos-tabla">
              <thead>
                <tr>
                  <th scope="col">Préstamo</th>
                  <th scope="col">Socio</th>
                  <th scope="col">Ejemplar</th>
                  <th scope="col">Vencimiento</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="acciones">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((p) => (
                  <tr key={p.id} className={p.atrasado ? 'mos-atrasado' : ''}>
                    <td>
                      <strong className="mono">{p.numero}</strong>
                      <small className="inv-sub">
                        {ETIQUETA_TIPO_PRESTAMO[p.tipo]}
                        {/* Interbibliotecario: de qué sede es el ejemplar (sede de origen) */}
                        {p.tipo === PrestamoTipo.INTERBIBLIOTECARIO && p.ejemplar && (
                          <span className="mos-origen">de {p.ejemplar.sede_origen.nombre}</span>
                        )}
                      </small>
                    </td>
                    <td>
                      <strong>{p.socio_nombre}</strong>
                      <small className="inv-sub">N° {p.socio_id}</small>
                    </td>
                    <td>
                      <strong>{p.ejemplar?.libro.nombre ?? '—'}</strong>
                      <small className="inv-sub">
                        <span className="mono">{p.ejemplar_codigo}</span>
                        {p.ejemplar ? ` · ${p.ejemplar.sede_actual.nombre}` : ''}
                      </small>
                    </td>
                    <td>
                      {formatearFecha(p.fecha_vencimiento)}
                      <small className={`inv-sub${p.atrasado ? ' mos-texto-mal' : ''}`}>
                        {textoVencimiento(p.fecha_vencimiento)}
                      </small>
                    </td>
                    <td>
                      <span className={`estado-pill est-${p.atrasado ? 'vencido' : 'activo'}`}>
                        <i aria-hidden="true" />
                        {p.atrasado && p.estado === PrestamoEstado.ACTIVO ? 'Atrasado' : ETIQUETA_ESTADO_PRESTAMO[p.estado]}
                      </span>
                    </td>
                    <td className="acciones">
                      <button className="inv-accion ok" onClick={() => setADevolver(p)}>
                        Registrar devolución
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
                Página {paginaActual} de {totalPaginas} · {filtrados.length} préstamos
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

      {aDevolver && (
        <DevolucionModal
          prestamo={aDevolver}
          sedeId={sedeId}
          sedeNombre={sedeNombre}
          usuarioId={usuarioId}
          onCerrar={() => setADevolver(null)}
          onDevuelto={alDevolver}
        />
      )}
    </>
  );
}

/** Confirmación de la devolución, con el estado físico del material devuelto. */
function DevolucionModal({
  prestamo,
  sedeId,
  sedeNombre,
  usuarioId,
  onCerrar,
  onDevuelto,
}: {
  prestamo: PrestamoVista;
  sedeId: number;
  sedeNombre: string;
  usuarioId: number;
  onCerrar: () => void;
  onDevuelto: (prestamoId: number, aviso: string) => void;
}) {
  const [conDanios, setConDanios] = useState(false);
  // Estado del ejemplar: arranca con su descripción actual para editarla
  const descripcionActual = prestamo.ejemplar?.descripcion_fisica ?? '';
  const [detalle, setDetalle] = useState(descripcionActual);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && !guardando && onCerrar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar, guardando]);

  const libro = prestamo.ejemplar?.libro;
  const confirmar = async () => {
    setGuardando(true);
    setError(null);
    try {
      // Solo se manda si cambió: si no, no hay nada nuevo que registrar
      const texto = detalle.trim();
      const cambio = texto && texto !== descripcionActual.trim() ? texto : null;
      await mostradorService.registrarDevolucion(prestamo.id, sedeId, usuarioId, conDanios, cambio);
      onDevuelto(
        prestamo.id,
        `Devolución registrada: préstamo ${prestamo.numero} finalizado${
          conDanios ? ', el ejemplar pasó a reparación' : ''
        }${prestamo.atrasado ? ' y se aplicó la sanción por retraso' : ''}.`,
      );
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo registrar la devolución.'));
      setGuardando(false);
    }
  };

  return (
    <div className="reservation-modal-backdrop" role="presentation">
      <section className="reservation-modal" role="dialog" aria-modal="true" aria-labelledby="devol-title">
        <button className="modal-close" onClick={onCerrar} aria-label="Cerrar" disabled={guardando}>
          <AdminIcon name="close" size={18} />
        </button>
        <span className="eyebrow">DEVOLUCIÓN</span>
        <h2 id="devol-title">Registrar devolución</h2>
        <div className="modal-book">
          {libro?.imagen_url && <img src={libro.imagen_url} alt="" />}
          <div>
            <strong>{libro?.nombre ?? `Ejemplar ${prestamo.ejemplar_codigo}`}</strong>
            <span>
              {prestamo.numero} · {prestamo.socio_nombre} · {prestamo.ejemplar_codigo}
              {prestamo.tipo === PrestamoTipo.INTERBIBLIOTECARIO && prestamo.ejemplar
                ? ` · interbibliotecario, de ${prestamo.ejemplar.sede_origen.nombre}`
                : ''}
            </span>
          </div>
        </div>

        {prestamo.atrasado && (
          <p className="fine-alert">
            Venció el {formatearFecha(prestamo.fecha_vencimiento)}
            {prestamo.dias < 0 ? ` (hace ${-prestamo.dias} ${prestamo.dias === -1 ? 'día' : 'días'})` : ''}: al registrar la
            devolución el sistema le aplica la sanción por retraso.
          </p>
        )}

        <label className="campo mos-detalle">
          <span>
            Estado del ejemplar <small>(opcional)</small>
          </span>
          <textarea
            rows={2}
            maxLength={200}
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            placeholder="Ej. Tapa con raspones leves"
          />
          <small className="mos-detalle-ayuda">
            <span>Queda en el historial del préstamo y actualiza la descripción física del ejemplar.</span>
            <span className={detalle.length >= 200 ? 'tope' : ''}>{detalle.length}/200</span>
          </small>
        </label>

        <label className={`mos-check${conDanios ? ' marcado' : ''}`}>
          <input type="checkbox" checked={conDanios} onChange={(e) => setConDanios(e.target.checked)} />
          <span>
            <strong>Devuelto con daños menores</strong>
            <small>El ejemplar pasa a reparación y el socio queda suspendido.</small>
          </span>
        </label>

        <p className="ejemplar-resumen mos-resumen">
          El ejemplar queda en <b>{sedeNombre}</b>
          {conDanios ? ' en reparación' : ' disponible (o reservado si alguien lo espera acá)'}.
        </p>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <div className="modal-actions">
          <button className="ghost-btn" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button className="confirm-reservation" onClick={() => void confirmar()} disabled={guardando}>
            {guardando ? 'REGISTRANDO…' : 'CONFIRMAR DEVOLUCIÓN'}
          </button>
        </div>
      </section>
    </div>
  );
}
