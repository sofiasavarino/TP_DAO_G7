/** Placeholder para las secciones del panel que todavía no están implementadas. */
export default function SeccionPendiente({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <span className="eyebrow">{titulo.toUpperCase()}</span>
          <h1>{titulo}</h1>
          <p className="muted">{descripcion}</p>
        </div>
      </div>
      <div className="admin-empty">
        <h3>Sección en construcción</h3>
        <p>Esta pantalla se implementa en otra tarea del panel de gestión.</p>
      </div>
    </section>
  );
}
