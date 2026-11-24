import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ejemplaresService } from '../../services/ejemplaresService';
import { remitosService } from '../../services/remitosService';
import type { EjemplarInventario, Sede } from '../../types/ejemplares';
import { EjemplarEstado, MotivoTraslado } from '../../types/enums';
import { AYUDA_MOTIVO, ETIQUETA_MOTIVO, type RemitoDetalle } from '../../types/remitos';
import { normalizar } from '../../utils/texto';
import AdminIcon from '../admin/AdminIcon';
import { mensajeDeError } from '../mostrador/avisos';

interface Props {
  sedes: Sede[];
  sedeUsuario: number;
  esAdmin: boolean;
  usuarioId: number;
  onCerrar: () => void;
  onCreado: (remito: RemitoDetalle) => void;
}

/** Solo viajan ejemplares que están físicamente en la sede de origen y en estos estados. */
const ESTADOS_TRANSFERIBLES: EjemplarEstado[] = [EjemplarEstado.DISPONIBLE, EjemplarEstado.RESERVADO];

/**
 * F8.2 – Alta de remito: motivo (IDA / REBALANCEO), sede de origen y destino, y los
 * ejemplares que viajan (se pueden elegir varios: generan las filas de remito_ejemplar).
 * El bibliotecario siempre envía desde su sede; el administrador puede elegir el origen.
 */
export default function RemitoAltaModal({ sedes, sedeUsuario, esAdmin, usuarioId, onCerrar, onCreado }: Props) {
  const activas = sedes.filter((s) => s.activo);
  const [motivo, setMotivo] = useState<MotivoTraslado>(MotivoTraslado.IDA);
  const [origen, setOrigen] = useState<number>(sedeUsuario);
  const [destino, setDestino] = useState<number | ''>('');
  const [observaciones, setObservaciones] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());

  const [ejemplares, setEjemplares] = useState<EjemplarInventario[]>([]);
  const [cargandoEj, setCargandoEj] = useState(true);
  const [errores, setErrores] = useState<{ destino?: string; ejemplares?: string }>({});
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Ejemplares de la sede de origen que se pueden enviar
  useEffect(() => {
    let vigente = true;
    setCargandoEj(true);
    setSeleccion(new Set());
    ejemplaresService
      .listar({ sede_id: origen })
      .then((lista) => {
        if (vigente)
          setEjemplares(lista.filter((e) => e.sede_actual_id === origen && ESTADOS_TRANSFERIBLES.includes(e.estado)));
      })
      .catch((e) => vigente && setErrorApi(mensajeDeError(e, 'No se pudo cargar el inventario de la sede.')))
      .finally(() => vigente && setCargandoEj(false));
    return () => {
      vigente = false;
    };
  }, [origen]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && !guardando && onCerrar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar, guardando]);

  const visibles = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return ejemplares;
    return ejemplares.filter(
      (e) =>
        normalizar(e.codigo_inventario).includes(q) ||
        normalizar(e.libro.nombre).includes(q) ||
        normalizar(e.signatura_topografica).includes(q),
    );
  }, [ejemplares, busqueda]);

  const alternar = (id: number) => {
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setErrores((x) => ({ ...x, ejemplares: undefined }));
  };

  const todosVisiblesElegidos = visibles.length > 0 && visibles.every((e) => seleccion.has(e.id));
  const alternarVisibles = () =>
    setSeleccion((s) => {
      const n = new Set(s);
      for (const e of visibles) {
        if (todosVisiblesElegidos) n.delete(e.id);
        else n.add(e.id);
      }
      return n;
    });

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const nuevos: typeof errores = {};
    if (destino === '') nuevos.destino = 'Elegí la sede de destino.';
    if (!seleccion.size) nuevos.ejemplares = 'Elegí al menos un ejemplar.';
    setErrores(nuevos);
    if (destino === '' || !seleccion.size) return;

    setGuardando(true);
    setErrorApi(null);
    try {
      const remito = await remitosService.crear(
        {
          motivo_traslado: motivo,
          sede_origen_id: origen,
          sede_destino_id: destino,
          ejemplar_ids: [...seleccion],
          observaciones: observaciones.trim() || null,
        },
        usuarioId,
      );
      onCreado(remito);
    } catch (err) {
      setErrorApi(mensajeDeError(err, 'No se pudo crear el remito.'));
      setGuardando(false);
    }
  };

  const nombreOrigen = sedes.find((s) => s.id === origen)?.nombre ?? '';
  const nombreDestino = sedes.find((s) => s.id === destino)?.nombre ?? '';

  return (
    <div className="reservation-modal-backdrop" role="presentation">
      <section className="reservation-modal rem-modal-ancho" role="dialog" aria-modal="true" aria-labelledby="remito-alta-title">
        <button className="modal-close" onClick={onCerrar} aria-label="Cerrar" disabled={guardando}>
          <AdminIcon name="close" size={18} />
        </button>
        <span className="eyebrow">NUEVO REMITO</span>
        <h2 id="remito-alta-title">Armar envío entre sedes</h2>

        <form className="ejemplar-form" onSubmit={guardar} noValidate>
          <div className="campo">
            <span>Motivo del traslado</span>
            <div className="pickup-options rem-motivos">
              {[MotivoTraslado.IDA, MotivoTraslado.REBALANCEO].map((m) => (
                <label key={m} className={motivo === m ? 'selected' : ''}>
                  <input type="radio" name="motivo" checked={motivo === m} onChange={() => setMotivo(m)} />
                  <span className="radio-mark" />
                  <div>
                    <strong>{ETIQUETA_MOTIVO[m]}</strong>
                    <small className="available-now">{AYUDA_MOTIVO[m]}</small>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="ejemplar-form-fila">
            <label className="campo">
              <span>Sede de origen</span>
              {esAdmin ? (
                <select value={origen} onChange={(e) => setOrigen(Number(e.target.value))}>
                  {activas.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              ) : (
                <input value={nombreOrigen} readOnly />
              )}
            </label>
            <label className="campo">
              <span>Sede de destino *</span>
              <select
                value={destino}
                onChange={(e) => {
                  setDestino(e.target.value ? Number(e.target.value) : '');
                  setErrores((x) => ({ ...x, destino: undefined }));
                }}
                aria-invalid={!!errores.destino}
              >
                <option value="">Elegí una sede</option>
                {activas
                  .filter((s) => s.id !== origen)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
              </select>
              {errores.destino && <small className="campo-error">{errores.destino}</small>}
            </label>
          </div>

          <div className="campo">
            <span>
              Ejemplares a enviar * <b className="rem-contador">{seleccion.size} elegidos</b>
            </span>
            <div className={`rem-picker${errores.ejemplares ? ' invalido' : ''}`}>
              <div className="rem-picker-barra">
                <label className="admin-search">
                  <AdminIcon name="search" size={16} />
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Filtrar por código, título o signatura"
                    aria-label="Filtrar ejemplares"
                  />
                </label>
                <button type="button" className="inv-limpiar" onClick={alternarVisibles} disabled={!visibles.length}>
                  {todosVisiblesElegidos ? 'Quitar visibles' : 'Elegir visibles'}
                </button>
              </div>
              {cargandoEj ? (
                <p className="rem-picker-vacio">Cargando ejemplares de {nombreOrigen}…</p>
              ) : !ejemplares.length ? (
                <p className="rem-picker-vacio">No hay ejemplares disponibles o reservados en {nombreOrigen}.</p>
              ) : !visibles.length ? (
                <p className="rem-picker-vacio">Ningún ejemplar coincide con el filtro.</p>
              ) : (
                <ul>
                  {visibles.map((e) => (
                    <li key={e.id}>
                      <label className={seleccion.has(e.id) ? 'marcado' : ''}>
                        <input type="checkbox" checked={seleccion.has(e.id)} onChange={() => alternar(e.id)} />
                        <span className="mono">{e.codigo_inventario}</span>
                        <span className="rem-picker-libro">{e.libro.nombre}</span>
                        {e.estado === EjemplarEstado.RESERVADO && <span className="rem-tag">Reservado</span>}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {errores.ejemplares && <small className="campo-error">{errores.ejemplares}</small>}
            <small className="campo-ayuda">
              Solo aparecen los ejemplares que están en {nombreOrigen} disponibles o reservados.
            </small>
          </div>

          <label className="campo">
            <span>Observaciones</span>
            <input
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej. Caja 2 de 3 · frágil"
            />
          </label>

          {destino !== '' && seleccion.size > 0 && (
            <p className="ejemplar-resumen">
              Se arma un remito <b>{ETIQUETA_MOTIVO[motivo].toLowerCase()}</b> de <b>{nombreOrigen}</b> a{' '}
              <b>{nombreDestino}</b> con <b>{seleccion.size}</b> ejemplar{seleccion.size === 1 ? '' : 'es'}. El número
              lo genera el sistema y queda listo para despachar.
            </p>
          )}

          {errorApi && (
            <div className="login-error" role="alert">
              {errorApi}
            </div>
          )}

          <div className="modal-actions">
            <button type="submit" className="confirm-reservation" disabled={guardando} style={{ width: '100%', marginTop: 0, borderRadius: 0 }}>
              {guardando ? 'CREANDO…' : 'CREAR REMITO'}
            </button>
            <button type="button" className="ghost-btn" onClick={onCerrar} disabled={guardando} style={{
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
                  }}>
              Cancelar
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
