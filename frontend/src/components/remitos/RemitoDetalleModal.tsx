import { useEffect, useState } from 'react';
import { remitosService } from '../../services/remitosService';
import {
  CLASE_ESTADO_REMITO,
  ETIQUETA_ESTADO_REMITO,
  ETIQUETA_MOTIVO,
  type RemitoDetalle,
} from '../../types/remitos';
import { formatearFecha } from '../../utils/fechas';
import AdminIcon from '../admin/AdminIcon';
import { mensajeDeError } from '../mostrador/avisos';

/** Detalle de un remito: recorrido, fechas de cada paso, ejemplares y observaciones (trazabilidad). */
export default function RemitoDetalleModal({
  remitoId,
  nombreSede,
  onCerrar,
}: {
  remitoId: number;
  nombreSede: (id: number) => string;
  onCerrar: () => void;
}) {
  const [remito, setRemito] = useState<RemitoDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    remitosService
      .obtener(remitoId)
      .then(setRemito)
      .catch((e) => setError(mensajeDeError(e, 'No se pudo cargar el remito.')));
  }, [remitoId]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar]);

  const pasos = remito
    ? [
        { texto: 'Creado', fecha: remito.fecha_creacion },
        { texto: 'Despachado', fecha: remito.fecha_despacho },
        { texto: remito.estado === 'CON_INCIDENCIA' ? 'Recibido con incidencia' : 'Recibido', fecha: remito.fecha_recepcion },
      ]
    : [];

  return (
    <div className="reservation-modal-backdrop" role="presentation" onClick={onCerrar}>
      <section
        className="reservation-modal rem-modal-ancho"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remito-detalle-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onCerrar} aria-label="Cerrar">
          <AdminIcon name="close" size={18} />
        </button>
        <span className="eyebrow">REMITO</span>
        {error ? (
          <div className="login-error" role="alert">
            {error}
          </div>
        ) : !remito ? (
          <div className="admin-skeleton" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
        ) : (
          <>
            <h2 id="remito-detalle-title" className="rem-detalle-titulo">
              {remito.numero_remito}
              <span className={`estado-pill ${CLASE_ESTADO_REMITO[remito.estado]}`}>
                <i aria-hidden="true" />
                {ETIQUETA_ESTADO_REMITO[remito.estado]}
              </span>
            </h2>
            <p className="muted rem-sub">
              {ETIQUETA_MOTIVO[remito.motivo_traslado]} · <b>{nombreSede(remito.sede_origen_id)}</b> →{' '}
              <b>{nombreSede(remito.sede_destino_id)}</b>
            </p>

            <ol className="rem-pasos">
              {pasos.map((p) => (
                <li key={p.texto} className={p.fecha ? 'hecho' : ''}>
                  <span aria-hidden="true" />
                  <strong>{p.texto}</strong>
                  <small>{p.fecha ? formatearFecha(p.fecha) : 'Pendiente'}</small>
                </li>
              ))}
            </ol>

            <h3 className="rem-detalle-sub">Ejemplares ({remito.ejemplares.length})</h3>
            <ul className="rem-detalle-ejemplares">
              {remito.ejemplares.map((e) => (
                <li key={e.id}>
                  <span className="mono">{e.codigo_inventario}</span>
                  <span>{e.libro_nombre}</span>
                </li>
              ))}
            </ul>

            {remito.observaciones && (
              <>
                <h3 className="rem-detalle-sub">Observaciones</h3>
                <p className="rem-observaciones">{remito.observaciones}</p>
              </>
            )}
          </>
        )}
        <div className="modal-actions">
          <button className="ghost-btn" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </section>
    </div>
  );
}
