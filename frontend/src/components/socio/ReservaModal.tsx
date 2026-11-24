import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../services/api';
import { reservasService } from '../../services/reservasService';
import type { Sede } from '../../types/ejemplares';
import { ReservaEstado, SocioEstado } from '../../types/enums';
import type { LibroListado } from '../../types/libros';
import type { Reserva, ReservaEta } from '../../types/reservas';
import { copiasEnSede, type Disponibilidad } from '../../utils/disponibilidad';
import { fmt } from '../../utils/fechas';
import { nombresAutores } from '../../utils/libros';
import Icon from './Icon';
import Portada from './Portada';

interface Props {
  libro: LibroListado;
  sedes: Sede[];
  disponibilidad: Disponibilidad;
  onClose: () => void;
  /** Se llama con la reserva creada (para refrescar disponibilidad y "mis reservas"). */
  onReservada: (reserva: Reserva) => void;
}

/** Estado de la vista previa de cada sede sin copias: cargando, la ETA o un error. */
type EtaSede = ReservaEta | 'cargando' | 'error';

/** Títulos amables para los errores de negocio que devuelve el backend. */
function tituloDeError(e: ApiError): string {
  const m = e.message.toLowerCase();
  if (m.includes('sanci')) return 'Tenés una sanción vigente';
  if (m.includes('límite') || m.includes('limite')) return 'Alcanzaste el máximo de libros';
  if (m.includes('ya tenés una reserva')) return 'Ya reservaste este libro';
  if (m.includes('no está activo')) return 'Tu cuenta no está activa';
  return 'No pudimos registrar la reserva';
}

/** Mensaje de confirmación según cómo quedó la reserva en el backend. */
function confirmacion(reserva: Reserva, sede: string): { titulo: string; texto: string } {
  if (reserva.estado === ReservaEstado.LISTA_PARA_RETIRO) {
    return {
      titulo: '¡Listo! Tu libro te espera',
      texto: `Retiralo en ${sede}${
        reserva.fecha_vencimiento_retiro ? ` hasta el ${fmt(reserva.fecha_vencimiento_retiro)}` : ''
      }. Pasada esa fecha la reserva vence y la copia pasa al siguiente socio.`,
    };
  }
  if (reserva.ejemplar_id) {
    return {
      titulo: 'Reserva confirmada',
      texto: `Pedimos una copia desde otra sede para que la retires en ${sede}. Te avisamos cuando llegue.`,
    };
  }
  return {
    titulo: 'Estás en la lista de espera',
    texto: `Hoy no hay copias libres en la red. Apenas se devuelva una te la asignamos para retirar en ${sede}.`,
  };
}

/** F3.4 – Elegir la sede de retiro (sede_retiro_id), confirmar y enviar POST /reservas. */
export default function ReservaModal({ libro, sedes, disponibilidad, onClose, onReservada }: Props) {
  const { usuario } = useAuth();

  // Por defecto: la sede del socio si tiene copias; si no, la primera con copias; si no, la del socio.
  const sedeInicial = useMemo(() => {
    const propia = usuario?.sede.id;
    if (propia && copiasEnSede(disponibilidad, libro.id, propia) > 0) return propia;
    const conCopias = sedes.find((s) => copiasEnSede(disponibilidad, libro.id, s.id) > 0);
    return conCopias?.id ?? propia ?? sedes[0]?.id ?? null;
  }, [usuario, sedes, disponibilidad, libro.id]);

  const [sedeId, setSedeId] = useState<number | null>(sedeInicial);
  const [etas, setEtas] = useState<Record<number, EtaSede>>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [creada, setCreada] = useState<Reserva | null>(null);

  const pendienteCuota = usuario?.estado_socio === SocioEstado.PENDIENTE_CUOTA;

  // Para las sedes sin copias en el estante, pedimos la fecha estimada (GET /reservas/eta)
  useEffect(() => {
    let vigente = true;
    const sinCopias = sedes.filter((s) => copiasEnSede(disponibilidad, libro.id, s.id) === 0);
    setEtas(Object.fromEntries(sinCopias.map((s) => [s.id, 'cargando' as const])));
    sinCopias.forEach((s) =>
      reservasService
        .eta(libro.id, s.id)
        .then((eta) => vigente && setEtas((cur) => ({ ...cur, [s.id]: eta })))
        .catch(() => vigente && setEtas((cur) => ({ ...cur, [s.id]: 'error' }))),
    );
    return () => {
      vigente = false;
    };
  }, [libro.id, sedes, disponibilidad]);

  // Escape cierra el modal (salvo mientras se envía)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !enviando && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enviando, onClose]);

  const leyendaSede = (sede: Sede): { texto: string; ahora: boolean } => {
    const copias = copiasEnSede(disponibilidad, libro.id, sede.id);
    if (copias > 0) {
      return {
        texto: `${copias} ${copias === 1 ? 'copia disponible' : 'copias disponibles'} · retiro inmediato`,
        ahora: true,
      };
    }
    const eta = etas[sede.id];
    if (eta === 'cargando' || eta === undefined) return { texto: 'Calculando disponibilidad…', ahora: false };
    if (eta === 'error') return { texto: 'Sin copias en esta sede', ahora: false };
    if (eta.disponible_ahora) return { texto: 'Disponible para retiro', ahora: true };
    if (eta.eta) return { texto: `Sin copias hoy · disponibilidad estimada: ${fmt(eta.eta)}`, ahora: false };
    return { texto: 'Sin copias en la red · quedás en lista de espera', ahora: false };
  };

  const confirmar = async () => {
    if (!sedeId || !usuario) return;
    if (!usuario.socio_id) {
      setError(new Error('Tu usuario no está asociado a un socio; acercate a una sede para regularizarlo.'));
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const reserva = await reservasService.crear(
        { socio_id: usuario.socio_id, libro_id: libro.id, sede_retiro_id: sedeId },
        usuario.id,
      );
      setCreada(reserva);
      onReservada(reserva);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Error inesperado'));
    } finally {
      setEnviando(false);
    }
  };

  const sedeElegida = sedes.find((s) => s.id === sedeId);
  const listo = creada ? confirmacion(creada, sedeElegida?.nombre ?? 'la sede elegida') : null;

  return (
    <div
      className="reservation-modal-backdrop"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && !enviando && onClose()}
    >
      <section className="reservation-modal" role="dialog" aria-modal="true" aria-labelledby="reservation-title">
        <button className="modal-close" onClick={onClose} disabled={enviando} aria-label="Cerrar">
          <Icon name="close" size={18} />
        </button>
        <span className="eyebrow">{listo ? 'RESERVA REGISTRADA' : 'RESERVAR EJEMPLAR'}</span>
        <h2 id="reservation-title">{listo ? listo.titulo : '¿Dónde querés retirarlo?'}</h2>
        <div className="modal-book">
          <Portada src={libro.imagen_url} titulo={libro.nombre} className="mini" />
          <div>
            <strong>{libro.nombre}</strong>
            <span>{nombresAutores(libro)}</span>
          </div>
        </div>

        {listo ? (
          <>
            <p className="reserva-ok" role="status">
              {listo.texto}
            </p>
            <button className="confirm-reservation" onClick={onClose}>
              Seguir explorando <Icon name="arrow" size={18} />
            </button>
          </>
        ) : (
          <>
            {sedes.length ? (
              <div className="pickup-options" role="radiogroup" aria-label="Sede de retiro">
                {sedes.map((sede) => {
                  const { texto, ahora } = leyendaSede(sede);
                  return (
                    <label key={sede.id} className={sedeId === sede.id ? 'selected' : ''}>
                      <input
                        type="radio"
                        name="sede-retiro"
                        value={sede.id}
                        checked={sedeId === sede.id}
                        onChange={() => setSedeId(sede.id)}
                        disabled={enviando}
                      />
                      <span className="radio-mark" />
                      <div>
                        <strong>
                          {sede.nombre}
                          {sede.id === usuario?.sede.id && ' · tu sede'}
                        </strong>
                        <small className={ahora ? 'available-now' : ''}>{texto}</small>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="muted">No hay sedes activas para retirar.</p>
            )}

            <p className="muted reserva-nota">
              Si hay copia en la sede elegida, te la guardamos 2 días hábiles. Si está en otra sede, la
              trasladamos y te avisamos cuando llegue.
            </p>

            {pendienteCuota && (
              <div className="reserva-aviso" role="status">
                <strong>Tenés pendiente el pago de la cuota social</strong>
                <span>
                  Recordá que debés abonar la cuota en la sede antes de poder retirar el libro.
                </span>
              </div>
            )}

            {error && (
              <div className="reserva-error" role="alert">
                <strong>{error instanceof ApiError ? tituloDeError(error) : 'No pudimos registrar la reserva'}</strong>
                <span>
                  {error instanceof ApiError || error.message !== 'Failed to fetch'
                    ? error.message
                    : 'No hay conexión con el servidor. Probá de nuevo en un momento.'}
                </span>
              </div>
            )}

            <button className="confirm-reservation" onClick={confirmar} disabled={!sedeId || enviando}>
              {enviando ? 'Reservando…' : 'Confirmar reserva'} {!enviando && <Icon name="arrow" size={18} />}
            </button>
          </>
        )}
      </section>
    </div>
  );
}