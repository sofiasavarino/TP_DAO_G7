/**
 * Normalización de nombres de autores para el front. La DB puede tener dos filas
 * distintas para "J. K. Rowling" y "J.K. Rowling" (o "MARIO VARGAS. LLOSA"), así que
 * agrupamos por clave sin tildes ni puntuación y mostramos siempre una forma prolija.
 */

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'von', 'van', 'du', 'da', 'di']);

/** Clave de agrupación: sin tildes, sin mayúsculas y sin puntos/espacios. */
export function claveAutor(nombre: string | null | undefined): string {
  if (!nombre) return '';
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/** Forma de muestra: iniciales separadas, sin puntos sobrantes y con mayúsculas correctas. */
export function autorLegible(nombre: string | null | undefined): string {
  if (!nombre?.trim()) return '';
  const limpio = nombre
    .trim()
    .replace(/\s+/g, ' ')
    // "J.K." → "J. K."
    .replace(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])\.(?=[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g, '$1. ')
    // "VARGAS. LLOSA" → "VARGAS LLOSA" (el punto sobra después de una palabra completa)
    .replace(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,})\.(?=\s|$)/g, '$1');

  return limpio
    .split(' ')
    .filter(Boolean)
    .map((palabra, i) => {
      const [base, ...resto] = palabra.split('.');
      const capitalizada = base.charAt(0).toLocaleUpperCase('es') + base.slice(1).toLocaleLowerCase('es');
      const forma = i > 0 && PARTICULAS.has(base.toLocaleLowerCase('es'))
        ? base.toLocaleLowerCase('es')
        : capitalizada;
      return resto.length ? `${forma}.${resto.join('.')}` : forma;
    })
    .join(' ');
}

/** ¿Dos nombres (o uno ya normalizado) apuntan al mismo autor? */
export function esMismoAutor(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = claveAutor(a);
  return !!ca && ca === claveAutor(b);
}
