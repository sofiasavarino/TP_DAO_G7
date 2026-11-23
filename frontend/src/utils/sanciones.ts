import { SancionTipo } from '../types/enums';
import type { Sancion } from '../types/socio';
import { daysLeft } from './fechas';

export const money = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

/** Último día de una suspensión: fecha_fin si la tiene; si no, inicio + días de suspensión. */
export function finSuspension(s: Sancion): string | null {
  if (s.fecha_fin) return s.fecha_fin;
  if (!s.dias_suspension) return null;
  const d = new Date(`${s.fecha_inicio}T00:00:00`);
  d.setDate(d.getDate() + s.dias_suspension);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Días que quedan de suspensión, contando hoy (la sanción sigue vigente el día de fecha_fin). */
export function diasRestantes(s: Sancion): number | null {
  const fin = finSuspension(s);
  return fin ? Math.max(1, daysLeft(fin) + 1) : null;
}

export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Título corto de cada sanción para el banner y la vista de sanciones. */
export function resumenSancion(s: Sancion): string {
  switch (s.tipo) {
    case SancionTipo.MULTA:
      return s.monto != null ? `Tenés una multa de ${money(s.monto)} sin abonar` : 'Tenés una multa sin abonar';
    case SancionTipo.SUSPENSION: {
      const dias = diasRestantes(s);
      return dias ? `Estás suspendido: te ${dias === 1 ? 'queda' : 'quedan'} ${plural(dias, 'día', 'días')}` : 'Estás suspendido';
    }
    default:
      return 'Tu cuenta está dada de baja hasta que repongas el libro';
  }
}
