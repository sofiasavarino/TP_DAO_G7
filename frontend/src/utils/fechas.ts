/** "2026-11-23" -> Date local (sin el corrimiento de zona horaria de new Date('yyyy-mm-dd')). */
function aFechaLocal(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(a!, (m ?? 1) - 1, d ?? 1);
}

/** "2026-11-23" -> "23/11/2026" */
export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  return aFechaLocal(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Días desde hoy hasta la fecha: 0 = hoy, negativo = ya pasó. */
export function diasHasta(iso: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((aFechaLocal(iso).getTime() - hoy.getTime()) / 86_400_000);
}

/** Texto corto relativo: "vence hoy", "vence en 3 días", "vencido hace 2 días". */
export function textoVencimiento(iso: string, verbo = 'vence'): string {
  const d = diasHasta(iso);
  if (d === 0) return `${verbo} hoy`;
  if (d === 1) return `${verbo} mañana`;
  if (d > 1) return `${verbo} en ${d} días`;
  return `vencido hace ${-d} ${d === -1 ? 'día' : 'días'}`;
}
