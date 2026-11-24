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
/** Fecha local en formato ISO yyyy-mm-dd. */
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Hoy + n días, en ISO. */
export const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

/** "2026-11-25" → "25 de noviembre". */
export const fmt = (s: string) =>
  new Date(`${s}T00:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });

/** Días que faltan hasta la fecha (negativo si ya pasó). */
export const daysLeft = (s: string) =>
  Math.round(
    (new Date(`${s}T00:00:00`).getTime() - new Date(`${addDays(0)}T00:00:00`).getTime()) / 86400000,
  );

  /** Suma días hábiles (sin sábados ni domingos) a una fecha YYYY-MM-DD. No considera feriados. */
export function sumarDiasHabiles(fecha: string, dias: number): string {
  const [y, m, d] = String(fecha).slice(0, 10).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  let restantes = dias;
  while (restantes > 0) {
    dt.setDate(dt.getDate() + 1);
    const dow = dt.getDay();
    if (dow !== 0 && dow !== 6) restantes--;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}