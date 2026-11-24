import type { Sede } from '../../types/ejemplares';

/**
 * Sedes de la red en el footer del portal: dirección, horarios y contacto.
 * Recibe las sedes de GET /api/v1/sedes, que ya viene filtrado por el backend
 * (`list_activos`): una sede dada de baja (activo = false) no aparece acá.
 */
export default function SedesFooter({ sedes }: { sedes: Sede[] }) {
  if (!sedes.length) return null;

  return (
    <section className="footer-sedes" aria-labelledby="footer-sedes-titulo">
      <span className="eyebrow" id="footer-sedes-titulo">
        NUESTRAS SEDES
      </span>
      <div className="footer-sedes-grid">
        {sedes.map((sede) => (
          <address key={sede.id}>
            <strong>{sede.nombre}</strong>
            <span>{sede.direccion}</span>
            {sede.horario_atencion && <span>{sede.horario_atencion}</span>}
            {sede.telefono && (
              <a href={`tel:${sede.telefono.replace(/[^\d+]/g, '')}`}>Tel. {sede.telefono}</a>
            )}
            {sede.email && <a href={`mailto:${sede.email}`}>{sede.email}</a>}
          </address>
        ))}
      </div>
    </section>
  );
}
