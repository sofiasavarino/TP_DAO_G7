import Icon from '../../components/socio/Icon';
import { SancionTipo } from '../../types/enums';
import type { PrestamoSocio, Sancion } from '../../types/socio';
import { fmt } from '../../utils/fechas';
import { diasRestantes, finSuspension, money, plural, resumenSancion } from '../../utils/sanciones';

interface Props {
  sanciones: Sancion[];
  prestamos: PrestamoSocio[];
  cargando: boolean;
  error: string | null;
  onReintentar: () => void;
  onVerPrestamos: () => void;
}

const ETIQUETA: Record<SancionTipo, string> = {
  [SancionTipo.MULTA]: 'MULTA',
  [SancionTipo.SUSPENSION]: 'SUSPENSIÓN',
  [SancionTipo.REPOSICION]: 'BAJA POR LIBRO PERDIDO',
};

/** F4.1 – Detalle de las sanciones vigentes del socio (GET /sanciones?socio_id=). */
export default function SancionesPage({ sanciones, prestamos, cargando, error, onReintentar, onVerPrestamos }: Props) {
  const totalMultas = sanciones
    .filter((s) => s.tipo === SancionTipo.MULTA)
    .reduce((acc, s) => acc + (s.monto ?? 0), 0);
  const prestamoDe = (s: Sancion) => prestamos.find((p) => p.id === s.prestamo_id);

  return (
    <section className="reservations-page fines-page">
      <span className="eyebrow">TU CUENTA</span>
      <h1>Sanciones</h1>
      <p>Multas, suspensiones y bajas vigentes. Mientras tengas alguna no podés reservar ni retirar libros.</p>

      {error ? (
        <div className="empty">
          <Icon name="bookmark" size={34} />
          <h3>No pudimos cargar tus sanciones</h3>
          <p>{error}</p>
          <button onClick={onReintentar}>Reintentar</button>
        </div>
      ) : cargando && !sanciones.length ? (
        <p className="muted">Cargando…</p>
      ) : (
        <>
          <div className="fines-summary">
            <div>
              <span>MULTAS A ABONAR</span>
              <strong>{money(totalMultas)}</strong>
            </div>
            <div>
              <span>ESTADO DE LA CUENTA</span>
              <strong className={sanciones.length ? 'account-bad' : 'account-ok'}>
                {sanciones.length ? 'Con sanción' : 'Al día'}
              </strong>
            </div>
          </div>

          {sanciones.map((s) => {
            const prestamo = prestamoDe(s);
            const fin = s.tipo === SancionTipo.SUSPENSION ? finSuspension(s) : null;
            const dias = s.tipo === SancionTipo.SUSPENSION ? diasRestantes(s) : null;
            return (
              <article className="fine-card" key={s.id}>
                <span className="eyebrow">{ETIQUETA[s.tipo]}</span>
                <h2>{resumenSancion(s)}</h2>
                <p>{s.motivo}</p>
                <dl>
                  <div>
                    <dt>Desde</dt>
                    <dd>{fmt(s.fecha_inicio)}</dd>
                  </div>
                  {fin && (
                    <div>
                      <dt>Hasta (inclusive)</dt>
                      <dd>{fmt(fin)}</dd>
                    </div>
                  )}
                  {dias && (
                    <div>
                      <dt>Días restantes</dt>
                      <dd>{plural(dias, 'día', 'días')}</dd>
                    </div>
                  )}
                  {prestamo && (
                    <div>
                      <dt>Préstamo</dt>
                      <dd>
                        {prestamo.numero} · {prestamo.libro_nombre}
                      </dd>
                    </div>
                  )}
                  {s.tipo === SancionTipo.MULTA && s.monto != null && (
                    <div className="total">
                      <dt>Total a abonar</dt>
                      <dd>{money(s.monto)}</dd>
                    </div>
                  )}
                </dl>
                {s.tipo === SancionTipo.MULTA && (
                  <p className="muted">Se abona en cualquier sede. Al abonarla quedás suspendido 15 días sin poder pedir libros.</p>
                )}
                {s.tipo === SancionTipo.REPOSICION && (
                  <p className="fine-alert">
                    Para volver a asociarte tenés que reponer una copia del libro (igual o posterior edición) en una sede.
                  </p>
                )}
                {prestamo && (
                  <button className="ghost-btn" onClick={onVerPrestamos}>
                    Ver préstamos
                  </button>
                )}
              </article>
            );
          })}

          {!sanciones.length && (
            <div className="empty fines-empty">
              <Icon name="bookmark" size={34} />
              <h3>No tenés sanciones vigentes</h3>
              <p>Tu cuenta está al día.</p>
            </div>
          )}
        </>
      )}

      <h3 className="list-title">Cómo se sanciona</h3>
      <ul className="rules">
        <li>Devolución fuera de plazo: multa de $5.000 más un 2% diario acumulado; al abonarla, 15 días de suspensión.</li>
        <li>Libro devuelto con daños menores (reparables): suspensión de 15 días.</li>
        <li>Daños mayores (irreparables): multa del 100% del costo del libro y suspensión hasta abonarla.</li>
        <li>Más de 2 meses de atraso: el libro se da por perdido y el socio se da de baja hasta reponerlo.</li>
      </ul>
    </section>
  );
}
