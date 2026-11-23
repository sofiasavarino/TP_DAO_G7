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
