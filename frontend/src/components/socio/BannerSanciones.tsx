import type { Sancion } from '../../types/socio';
import { fmt } from '../../utils/fechas';
import { finSuspension, resumenSancion } from '../../utils/sanciones';
import { SancionTipo } from '../../types/enums';

/** F4.1 – Aviso fijo arriba del portal mientras el socio tenga una sanción vigente. */
export default function BannerSanciones({ sanciones, onVerDetalle }: { sanciones: Sancion[]; onVerDetalle: () => void }) {
  if (!sanciones.length) return null;
  return (
    <div className="banner-sanciones" role="alert">
      <div>
        <strong>{sanciones.length === 1 ? 'Tenés una sanción vigente' : `Tenés ${sanciones.length} sanciones vigentes`}</strong>
        <ul>
          {sanciones.map((s) => {
            const fin = s.tipo === SancionTipo.SUSPENSION ? finSuspension(s) : null;
            return (
              <li key={s.id}>
                {resumenSancion(s)}
                {fin && ` (hasta el ${fmt(fin)})`}.
              </li>
            );
          })}
        </ul>
        <small>Mientras tanto no podés reservar ni retirar libros.</small>
      </div>
      <button onClick={onVerDetalle}>Ver detalle</button>
    </div>
  );
}
