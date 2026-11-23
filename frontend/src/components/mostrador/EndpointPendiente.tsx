/**
 * Se muestra cuando una parte del mostrador depende de un endpoint que el backend
 * todavía no tiene (FastAPI responde 404 "Not Found"). Apenas se agregue, desaparece sola.
 */
export default function EndpointPendiente({
  titulo,
  endpoint,
  descripcion,
}: {
  titulo: string;
  endpoint: string;
  descripcion: string;
}) {
  return (
    <div className="admin-empty mos-pendiente">
      <h3>{titulo}</h3>
      <p>{descripcion}</p>
      <code>{endpoint}</code>
    </div>
  );
}
