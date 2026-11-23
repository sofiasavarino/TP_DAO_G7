import { useEffect, useState } from 'react';
import { remitosService } from '../../services/remitosService';
import { EjemplarEstado } from '../../types/enums';
import type { IncidenciaItem, RemitoDetalle } from '../../types/remitos';
import AdminIcon from '../admin/AdminIcon';
import { mensajeDeError } from '../mostrador/avisos';

type EstadoDanio = IncidenciaItem['estado'];

interface Props {
  remitoId: number;
  origen: string;
  destino: string;
  usuarioId: number;
  onCerrar: () => void;
  onRecibido: (aviso: string) => void;
}

/**
 * F8.2 – Recepción de un remito EN_TRANSITO en la sede de destino.
 * Si todo llegó bien queda RECIBIDO; si se marca algún ejemplar dañado queda CON_INCIDENCIA
 * (y hay que contar qué pasó en la observación). Los dañados van a reparación o quedan inutilizables.
 */
export default function RecepcionModal({ remitoId, origen, destino, usuarioId, onCerrar, onRecibido }: Props) {
  const [remito, setRemito] = useState<RemitoDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [danios, setDanios] = useState<Map<number, EstadoDanio>>(new Map());
  const [observaciones, setObservaciones] = useState('');
  const [errorObs, setErrorObs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    remitosService
      .obtener(remitoId)
      .then(setRemito)
      .catch((e) => setError(mensajeDeError(e, 'No se pudo cargar el remito.')))
      .finally(() => setCargando(false));
  }, [remitoId]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && !guardando && onCerrar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar, guardando]);

  const conIncidencia = danios.size > 0;

  const marcar = (id: number, estado: EstadoDanio | null) => {
    setDanios((d) => {
      const n = new Map(d);
      if (estado) n.set(id, estado);
      else n.delete(id);
      return n;
    });
    setErrorObs(null);
  };

  const confirmar = async () => {
    if (!remito) return;
    if (conIncidencia && !observaciones.trim()) {
      setErrorObs('Contá qué pasó con los ejemplares dañados.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const incidencias: IncidenciaItem[] = [...danios].map(([ejemplar_id, estado]) => ({ ejemplar_id, estado }));
      await remitosService.recibir(remito.id, usuarioId, incidencias, observaciones.trim() || null);
      onRecibido(
        conIncidencia
          ? `Remito ${remito.numero_remito} recibido con incidencia: ${danios.size} ejemplar${
              danios.size === 1 ? '' : 'es'
            } dañado${danios.size === 1 ? '' : 's'}.`
          : `Remito ${remito.numero_remito} recibido en ${destino}: ${remito.ejemplares.length} ejemplares ingresados.`,
      );
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo registrar la recepción.'));
      setGuardando(false);
    }
  };

  return (
    <div className="reservation-modal-backdrop" role="presentation">
      <section className="reservation-modal rem-modal-ancho" role="dialog" aria-modal="true" aria-labelledby="recepcion-title">
        <button className="modal-close" onClick={onCerrar} aria-label="Cerrar" disabled={guardando}>
          <AdminIcon name="close" size={18} />
        </button>
        <span className="eyebrow">RECEPCIÓN</span>
        <h2 id="recepcion-title">Recibir {remito?.numero_remito ?? 'remito'}</h2>
        <p className="muted rem-sub">
          {origen} → {destino}. Revisá cada ejemplar: si alguno llegó dañado, marcalo.
        </p>

        {cargando ? (
          <div className="admin-skeleton" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
        ) : remito ? (
          <ul className="rem-recepcion">
            {remito.ejemplares.map((e) => {
              const danio = danios.get(e.id) ?? null;
              return (
                <li key={e.id} className={danio ? 'danado' : ''}>
                  <div>
                    <strong>{e.libro_nombre}</strong>
                    <small>
                      <span className="mono">{e.codigo_inventario}</span>
                      {e.descripcion_fisica ? ` · ${e.descripcion_fisica}` : ''}
                    </small>
                  </div>
                  <div className="rem-recepcion-estado" role="radiogroup" aria-label={`Estado de ${e.codigo_inventario}`}>
                    {(
                      [
                        [null, 'Llegó bien'],
                        [EjemplarEstado.EN_REPARACION, 'Dañado'],
                        [EjemplarEstado.INUTILIZABLE, 'Inutilizable'],
                      ] as const
                    ).map(([valor, texto]) => (
                      <button
                        key={texto}
                        type="button"
                        role="radio"
                        aria-checked={danio === valor}
                        className={danio === valor ? `activo ${valor ? 'mal' : 'bien'}` : ''}
                        onClick={() => marcar(e.id, valor)}
                      >
                        {texto}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        <label className="campo rem-obs">
          <span>Observaciones{conIncidencia ? ' *' : ''}</span>
          <textarea
            rows={2}
            value={observaciones}
            onChange={(e) => {
              setObservaciones(e.target.value);
              setErrorObs(null);
            }}
            placeholder={conIncidencia ? 'Ej. Caja mojada: tapa y primeras páginas dañadas' : 'Opcional'}
            aria-invalid={!!errorObs}
          />
          {errorObs && <small className="campo-error">{errorObs}</small>}
        </label>

        <p className={`ejemplar-resumen rem-resumen${conIncidencia ? ' mal' : ''}`}>
          {conIncidencia ? (
            <>
              El remito queda <b>con incidencia</b>. Los ejemplares dañados quedan en {destino} en reparación o
              inutilizables; el resto queda disponible (o reservado si alguien lo espera).
            </>
          ) : (
            <>
              El remito queda <b>recibido</b> y los ejemplares pasan a {destino}: disponibles, o reservados si alguien
              los espera.
            </>
          )}
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
          <button className="confirm-reservation" onClick={() => void confirmar()} disabled={guardando || !remito}>
            {guardando ? 'REGISTRANDO…' : conIncidencia ? 'REPORTAR INCIDENCIA' : 'CONFIRMAR RECEPCIÓN'}
          </button>
        </div>
      </section>
    </div>
  );
}
