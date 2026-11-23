import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminIcon from '../../components/admin/AdminIcon';
import { mensajeDeError, type Aviso } from '../../components/mostrador/avisos';
import RecepcionModal from '../../components/remitos/RecepcionModal';
import RemitoAltaModal from '../../components/remitos/RemitoAltaModal';
import RemitoDetalleModal from '../../components/remitos/RemitoDetalleModal';
import { useAuth } from '../../context/AuthContext';
import { sedesService } from '../../services/ejemplaresService';
import { remitosService } from '../../services/remitosService';
import type { Sede } from '../../types/ejemplares';
import { RemitoEstado, RolNombre } from '../../types/enums';
import {
  CLASE_ESTADO_REMITO,
  ETIQUETA_ESTADO_REMITO,
  ETIQUETA_MOTIVO,
  type RemitoListado,
} from '../../types/remitos';
import { formatearFecha } from '../../utils/fechas';
import { normalizar } from '../../utils/texto';
import './remitos.css';

const POR_PAGINA = 20;
type FiltroEstado = 'TODOS' | RemitoEstado;
/** "mia" = remitos que salen de o llegan a la sede del usuario. */
type FiltroSede = 'mia' | 'todas' | number;

/**
 * F8.1 / F8.2 – Remitos entre sedes: listado con seguimiento de estado, alta de remitos
 * con varios ejemplares, despacho (EN_TRANSITO) y recepción (RECIBIDO o CON_INCIDENCIA).
 * El bibliotecario despacha desde su sede y recibe en su sede; el administrador, en cualquiera.
 */
export default function RemitosPage() {
  const { usuario, rol } = useAuth();
  const esAdmin = rol === RolNombre.ADMINISTRADOR;
  const miSede = usuario?.sede.id ?? null;

  const [remitos, setRemitos] = useState<RemitoListado[]>([]);
  const [completo, setCompleto] = useState(true);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('TODOS');
  const [filtroSede, setFiltroSede] = useState<FiltroSede>(esAdmin ? 'todas' : 'mia');
  const [pagina, setPagina] = useState(1);

  const [altaAbierta, setAltaAbierta] = useState(false);
  const [aRecibir, setARecibir] = useState<RemitoListado | null>(null);
  const [aDespachar, setADespachar] = useState<RemitoListado | null>(null);
  const [detalleId, setDetalleId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [{ remitos: lista, completo: todos }, s] = await Promise.all([remitosService.listar(), sedesService.listar()]);
      setRemitos(lista);
      setCompleto(todos);
      setSedes(s);
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudieron cargar los remitos.'));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 6000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  useEffect(() => setPagina(1), [busqueda, filtroEstado, filtroSede]);

  const nombreSede = useCallback((id: number) => sedes.find((s) => s.id === id)?.nombre ?? `Sede #${id}`, [sedes]);

  // Filtro por sede primero: los contadores de estado se calculan sobre esa selección
  const deLaSede = useMemo(() => {
    const sede = filtroSede === 'mia' ? miSede : filtroSede === 'todas' ? null : filtroSede;
    return sede === null ? remitos : remitos.filter((r) => r.sede_origen_id === sede || r.sede_destino_id === sede);
  }, [remitos, filtroSede, miSede]);

  const conteo = useMemo(() => {
    const c: Record<FiltroEstado, number> = { TODOS: deLaSede.length } as Record<FiltroEstado, number>;
    for (const e of Object.values(RemitoEstado)) c[e] = deLaSede.filter((r) => r.estado === e).length;
    return c;
  }, [deLaSede]);

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    return deLaSede.filter(
      (r) =>
        (filtroEstado === 'TODOS' || r.estado === filtroEstado) &&
        (!q ||
          normalizar(r.numero_remito).includes(q) ||
          normalizar(nombreSede(r.sede_origen_id)).includes(q) ||
          normalizar(nombreSede(r.sede_destino_id)).includes(q)),
    );
  }, [deLaSede, filtroEstado, busqueda, nombreSede]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  // Permisos por sede: despacha la sede de origen, recibe la de destino (el admin, todas)
  const puedeDespachar = (r: RemitoListado) => esAdmin || r.sede_origen_id === miSede;
  const puedeRecibir = (r: RemitoListado) => esAdmin || r.sede_destino_id === miSede;

  const alCambiar = (texto: string) => {
    setAviso({ tipo: 'ok', texto });
    void cargar();
  };

  const ESTADOS: FiltroEstado[] = ['TODOS', ...Object.values(RemitoEstado)];

  if (!usuario || miSede === null) {
    return (
      <section className="admin-page">
        <div className="admin-empty">
          <h3>Cargando sesión…</h3>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <span className="eyebrow">TRASLADOS ENTRE SEDES</span>
          <h1>
            <em>Remitos</em>
          </h1>
          <p className="muted">
            {cargando ? 'Cargando…' : `${deLaSede.length} remitos · ${conteo[RemitoEstado.EN_TRANSITO]} en tránsito`}
          </p>
        </div>
        <button className="admin-primary" onClick={() => setAltaAbierta(true)}>
          <AdminIcon name="plus" size={18} />
          Nuevo remito
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

      <div className="inv-filtros">
        <label className="admin-search">
          <AdminIcon name="search" size={17} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="N° de remito o sede"
            aria-label="Buscar remito"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} aria-label="Borrar búsqueda">
              <AdminIcon name="close" size={15} />
            </button>
          )}
        </label>
        <label className="inv-select">
          <span className="sr-only">Sede</span>
          <select
            value={String(filtroSede)}
            onChange={(e) => {
              const v = e.target.value;
              setFiltroSede(v === 'mia' || v === 'todas' ? v : Number(v));
            }}
          >
            <option value="mia">Mi sede ({usuario.sede.nombre})</option>
            <option value="todas">Todas las sedes</option>
            {esAdmin &&
              sedes
                .filter((s) => s.id !== miSede)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
          </select>
        </label>
      </div>

      <div className="inv-estados" role="group" aria-label="Filtrar por estado">
        {ESTADOS.map((e) => (
          <button
            key={e}
            className={`${filtroEstado === e ? 'activo ' : ''}${e === 'TODOS' ? '' : CLASE_ESTADO_REMITO[e]}`}
            onClick={() => setFiltroEstado(e)}
            aria-pressed={filtroEstado === e}
          >
            {e !== 'TODOS' && <i aria-hidden="true" />}
            {e === 'TODOS' ? 'Todos' : ETIQUETA_ESTADO_REMITO[e]} <b>{conteo[e]}</b>
          </button>
        ))}
      </div>

      {!completo && !cargando && (
        <p className="rem-nota">
          Se muestran los remitos en curso y con incidencia. Los ya recibidos van a aparecer cuando el backend tenga{' '}
          <code>GET /api/v1/remitos</code>.
        </p>
      )}

      {error ? (
        <div className="admin-empty">
          <h3>No pudimos cargar los remitos</h3>
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
          <h3>{deLaSede.length ? 'Sin resultados' : 'No hay remitos'}</h3>
          <p>
            {deLaSede.length
              ? 'Ningún remito coincide con los filtros.'
              : 'Armá un remito para mandar ejemplares a otra sede.'}
          </p>
          {!deLaSede.length && (
            <button className="admin-primary" onClick={() => setAltaAbierta(true)}>
              <AdminIcon name="plus" size={18} />
              Nuevo remito
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table inv-tabla rem-tabla">
              <thead>
                <tr>
                  <th scope="col">Remito</th>
                  <th scope="col">Recorrido</th>
                  <th scope="col">Ejemplares</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Último movimiento</th>
                  <th scope="col" className="acciones">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <button className="rem-numero" onClick={() => setDetalleId(r.id)}>
                        {r.numero_remito}
                      </button>
                      <small className="inv-sub">{ETIQUETA_MOTIVO[r.motivo_traslado]}</small>
                    </td>
                    <td>
                      <span className="rem-recorrido">
                        <span className={r.sede_origen_id === miSede ? 'mia' : ''}>{nombreSede(r.sede_origen_id)}</span>
                        <span aria-label="hacia">→</span>
                        <span className={r.sede_destino_id === miSede ? 'mia' : ''}>{nombreSede(r.sede_destino_id)}</span>
                      </span>
                    </td>
                    <td className="num">{r.ejemplares_count}</td>
                    <td>
                      <span className={`estado-pill ${CLASE_ESTADO_REMITO[r.estado]}`}>
                        <i aria-hidden="true" />
                        {ETIQUETA_ESTADO_REMITO[r.estado]}
                      </span>
                    </td>
                    <td>
                      <UltimoMovimiento remito={r} />
                    </td>
                    <td className="acciones">
                      <div className="inv-acciones">
                      {r.estado === RemitoEstado.CREADO && (
                        <button
                          className="inv-accion ok"
                          onClick={() => setADespachar(r)}
                          disabled={!puedeDespachar(r)}
                          title={puedeDespachar(r) ? undefined : 'Lo despacha la sede de origen'}
                        >
                          Despachar
                        </button>
                      )}
                      {r.estado === RemitoEstado.EN_TRANSITO && (
                        <button
                          className="inv-accion ok"
                          onClick={() => setARecibir(r)}
                          disabled={!puedeRecibir(r)}
                          title={puedeRecibir(r) ? undefined : 'Lo recibe la sede de destino'}
                        >
                          Recibir
                        </button>
                      )}
                      <button className="inv-accion" onClick={() => setDetalleId(r.id)}>
                        Ver
                      </button>
                      </div>
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
                Página {paginaActual} de {totalPaginas} · {filtrados.length} remitos
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
        <RemitoAltaModal
          sedes={sedes}
          sedeUsuario={miSede}
          esAdmin={esAdmin}
          usuarioId={usuario.id}
          onCerrar={() => setAltaAbierta(false)}
          onCreado={(remito) => {
            setAltaAbierta(false);
            alCambiar(
              `Remito ${remito.numero_remito} creado con ${remito.ejemplares.length} ejemplar${
                remito.ejemplares.length === 1 ? '' : 'es'
              }. Queda listo para despachar.`,
            );
          }}
        />
      )}

      {aDespachar && (
        <DespachoModal
          remito={aDespachar}
          origen={nombreSede(aDespachar.sede_origen_id)}
          destino={nombreSede(aDespachar.sede_destino_id)}
          usuarioId={usuario.id}
          onCerrar={() => setADespachar(null)}
          onDespachado={(texto) => {
            setADespachar(null);
            alCambiar(texto);
          }}
        />
      )}

      {aRecibir && (
        <RecepcionModal
          remitoId={aRecibir.id}
          origen={nombreSede(aRecibir.sede_origen_id)}
          destino={nombreSede(aRecibir.sede_destino_id)}
          usuarioId={usuario.id}
          onCerrar={() => setARecibir(null)}
          onRecibido={(texto) => {
            setARecibir(null);
            alCambiar(texto);
          }}
        />
      )}

      {detalleId !== null && (
        <RemitoDetalleModal remitoId={detalleId} nombreSede={nombreSede} onCerrar={() => setDetalleId(null)} />
      )}
    </section>
  );
}

function UltimoMovimiento({ remito }: { remito: RemitoListado }) {
  const [texto, fecha] = remito.fecha_recepcion
    ? ['Recibido', remito.fecha_recepcion]
    : remito.fecha_despacho
      ? ['Despachado', remito.fecha_despacho]
      : ['Creado', remito.fecha_creacion];
  return (
    <>
      {formatearFecha(fecha)}
      <small className="inv-sub">{texto}</small>
    </>
  );
}

/** Confirmación del despacho: los ejemplares salen de la sede y pasan a EN_TRANSITO. */
function DespachoModal({
  remito,
  origen,
  destino,
  usuarioId,
  onCerrar,
  onDespachado,
}: {
  remito: RemitoListado;
  origen: string;
  destino: string;
  usuarioId: number;
  onCerrar: () => void;
  onDespachado: (aviso: string) => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && !guardando && onCerrar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar, guardando]);

  const confirmar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await remitosService.despachar(remito.id, usuarioId);
      onDespachado(`Remito ${remito.numero_remito} despachado: ${remito.ejemplares_count} ejemplares en camino a ${destino}.`);
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo despachar el remito.'));
      setGuardando(false);
    }
  };

  return (
    <div className="reservation-modal-backdrop" role="presentation">
      <section className="reservation-modal" role="dialog" aria-modal="true" aria-labelledby="despacho-title">
        <button className="modal-close" onClick={onCerrar} aria-label="Cerrar" disabled={guardando}>
          <AdminIcon name="close" size={18} />
        </button>
        <span className="eyebrow">DESPACHO</span>
        <h2 id="despacho-title">¿Despachar el remito?</h2>
        <div className="modal-book">
          <div>
            <strong>{remito.numero_remito}</strong>
            <span>
              {origen} → {destino} · {remito.ejemplares_count} ejemplares
            </span>
          </div>
        </div>
        <p className="ejemplar-resumen rem-resumen">
          El remito pasa a <b>en tránsito</b> y sus ejemplares dejan de estar disponibles en {origen} hasta que{' '}
          {destino} confirme la recepción.
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
            {guardando ? 'DESPACHANDO…' : 'CONFIRMAR DESPACHO'}
          </button>
        </div>
      </section>
    </div>
  );
}
