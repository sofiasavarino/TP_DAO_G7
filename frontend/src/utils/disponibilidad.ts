import type { Ejemplar, Sede } from '../types/ejemplares';

/** libro_id → (sede_id → cantidad de copias DISPONIBLE en esa sede). */
export type Disponibilidad = Map<number, Map<number, number>>;

/** Agrupa las copias DISPONIBLE por libro y por sede ACTUAL (inventario flotante). */
export function agruparDisponibles(ejemplares: Ejemplar[]): Disponibilidad {
  const porLibro: Disponibilidad = new Map();
  for (const e of ejemplares) {
    const porSede = porLibro.get(e.libro_id) ?? new Map<number, number>();
    porSede.set(e.sede_actual_id, (porSede.get(e.sede_actual_id) ?? 0) + 1);
    porLibro.set(e.libro_id, porSede);
  }
  return porLibro;
}

export function copiasEnSede(disp: Disponibilidad, libroId: number, sedeId: number): number {
  return disp.get(libroId)?.get(sedeId) ?? 0;
}

export function totalCopias(disp: Disponibilidad, libroId: number): number {
  let total = 0;
  disp.get(libroId)?.forEach((n) => (total += n));
  return total;
}

/** Sedes con al menos una copia del libro, con su cantidad (en el orden de `sedes`). */
export function sedesConCopias(
  disp: Disponibilidad,
  libroId: number,
  sedes: Sede[],
): { sede: Sede; copias: number }[] {
  return sedes
    .map((sede) => ({ sede, copias: copiasEnSede(disp, libroId, sede.id) }))
    .filter((x) => x.copias > 0);
}
