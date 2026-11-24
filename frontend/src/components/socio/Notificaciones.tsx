import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notificacionesService } from '../../services/socioService';
import { NotificacionTipo } from '../../types/enums';
import type { Notificacion } from '../../types/socio';
import Icon from './Icon';

/** Cada cuánto se consulta el contador de no leídas (ms). */
const INTERVALO_CONTADOR = 60_000;

/** Etiqueta y tono de cada tipo de notificación. */
const TIPO: Record<NotificacionTipo, { etiqueta: string; tono: 'ok' | 'alerta' | 'info' }> = {
  [NotificacionTipo.RESERVA_LISTA]: { etiqueta: 'RESERVA LISTA', tono: 'ok' },
  [NotificacionTipo.EJEMPLAR_ASIGNADO]: { etiqueta: 'EJEMPLAR ASIGNADO', tono: 'info' },
  [NotificacionTipo.RESERVA_VENCIDA]: { etiqueta: 'RESERVA VENCIDA', tono: 'alerta' },
  [NotificacionTipo.SANCION_APLICADA]: { etiqueta: 'SANCIÓN APLICADA', tono: 'alerta' },
  [NotificacionTipo.SANCION_LEVANTADA]: { etiqueta: 'SANCIÓN LEVANTADA', tono: 'ok' },
  [NotificacionTipo.PASSWORD_REESTABLECIDA]: { etiqueta: 'CONTRASEÑA REESTABLECIDA', tono: 'alerta' },
};

/** "hace 5 min", "hace 3 h", "ayer", "12 de noviembre". */
function haceCuanto(iso: string): string {
  const fecha = new Date(iso);
  const minutos = Math.round((Date.now() - fecha.getTime()) / 60_000);
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  if (horas < 48) return 'ayer';
  return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}

/**
 * F4.4 – Campanita del header: contador de no leídas, listado por tipo y marcar como leídas.
 * `onAbrir` permite refrescar reservas/préstamos/sanciones (una notificación nueva suele
 * venir de un cambio en alguno de ellos).
 */
export default function Notificaciones({ onAbrir }: { onAbrir?: () => void }) {
  const { usuario } = useAuth();
  const usuarioId = usuario?.id;
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const actualizarContador = useCallback(async () => {
    if (!usuarioId) return;
    try {
      setNoLeidas((await notificacionesService.cantidadNoLeidas(usuarioId)).cantidad);
    } catch {
      // El contador es accesorio: si falla, queda el último valor
    }
  }, [usuarioId]);

  // Contador al entrar y cada minuto
  useEffect(() => {
    void actualizarContador();
    const id = window.setInterval(() => void actualizarContador(), INTERVALO_CONTADOR);
    return () => window.clearInterval(id);
  }, [actualizarContador]);

  // Click fuera cierra el desplegable
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [abierto]);

  const abrir = async () => {
    const abrir = !abierto;
    setAbierto(abrir);
    if (!abrir || !usuarioId) return;
    onAbrir?.();
    setCargando(true);
    setError(false);
    try {
      const data = await notificacionesService.mias(usuarioId);
      setLista(data);
      setNoLeidas(data.filter((n) => !n.leida).length);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  };

  const marcarLeida = async (n: Notificacion) => {
    if (n.leida || !usuarioId) return;
    // Optimista: se marca al instante y se revierte si el backend falla
    setLista((cur) => cur.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
    setNoLeidas((c) => Math.max(0, c - 1));
    try {
      await notificacionesService.marcarLeida(n.id, usuarioId);
    } catch {
      setLista((cur) => cur.map((x) => (x.id === n.id ? { ...x, leida: false } : x)));
      setNoLeidas((c) => c + 1);
    }
  };

  const marcarTodas = async () => {
    if (!usuarioId || !noLeidas) return;
    const antes = lista;
    setLista((cur) => cur.map((x) => ({ ...x, leida: true })));
    setNoLeidas(0);
    try {
      await notificacionesService.marcarTodasLeidas(usuarioId);
    } catch {
      setLista(antes);
      setNoLeidas(antes.filter((n) => !n.leida).length);
    }
  };

  return (
    <div className="notificaciones" ref={ref}>
      <button
        className={`notification-button${noLeidas ? ' has-notifications' : ''}`}
        onClick={abrir}
        aria-label={noLeidas ? `Notificaciones: ${noLeidas} sin leer` : 'Notificaciones'}
        aria-expanded={abierto}
      >
        <Icon name="bell" size={21} />
        {noLeidas > 0 && <span className="contador">{noLeidas > 9 ? '9+' : noLeidas}</span>}
      </button>

      {abierto && (
        <div className="header-popover notice-popover notif-panel" role="dialog" aria-label="Notificaciones">
          <div className="notif-head">
            <span className="popover-kicker">NOTIFICACIONES</span>
            {noLeidas > 0 && (
              <button className="notif-todas" onClick={marcarTodas}>
                Marcar todas como leídas
              </button>
            )}
          </div>

          {cargando && !lista.length ? (
            <p>Cargando…</p>
          ) : error ? (
            <p>No pudimos cargar tus notificaciones.</p>
          ) : !lista.length ? (
            <p>No tenés notificaciones por ahora.</p>
          ) : (
            <ul className="notif-lista">
              {lista.map((n) => {
                const tipo = TIPO[n.tipo] ?? { etiqueta: n.tipo, tono: 'info' as const };
                return (
                  <li key={n.id}>
                    <button
                      className={`notif-item ${n.leida ? 'leida' : 'no-leida'}`}
                      onClick={() => marcarLeida(n)}
                      title={n.leida ? undefined : 'Marcar como leída'}
                    >
                      <span className={`notif-tipo ${tipo.tono}`}>{tipo.etiqueta}</span>
                      <strong>{n.titulo}</strong>
                      <p>{n.cuerpo}</p>
                      <small>
                        {haceCuanto(n.fecha_creacion)}
                        {!n.leida && ' · sin leer'}
                      </small>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
