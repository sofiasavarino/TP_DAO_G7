/**
 * Géneros legibles para el front. La DB guarda lo que viene de Google Books
 * (strings sueltos, a veces compuestos), así que acá se separan y se traducen
 * sin tocar el backend. La clave es el valor crudo en minúsculas: los temas con
 * coma ("Authors, Latin American") son UNO solo, no dos géneros.
 */

const GENEROS: Record<string, string[]> = {
  'fiction': ['Ficción'],
  'juvenile fiction': ['Ficción juvenil'],
  'drama': ['Drama'],
  'spanish language': ['Lengua española'],
  'literary collections': ['Colecciones literarias'],
  'spanish fiction': ['Ficción española'],
  'schools': ['Escuelas'],
  'realismo mágico': ['Realismo mágico'],
  'prose poems, spanish': ['Poemas en prosa españoles'],
  'poetry': ['Poesía'],
  'novela': ['Novela'],
  'music': ['Música'],
  'literary criticism': ['Crítica literaria'],
  'latin american fiction': ['Ficción latinoamericana'],
  'fantasy fiction, argentine': ['Fantasía', 'Ficción argentina'],
  'education': ['Educación'],
  'death': ['Muerte'],
  'cuento': ['Cuento'],
  'colombian fiction': ['Ficción colombiana'],
  'colombia': ['Colombia'],
  'buenos aires (argentina)': ['Buenos Aires (Argentina)'],
  'biography & autobiography': ['Biografía y autobiografía'],
  'barcelona (spain)': ['Barcelona (España)'],
  'authors, latin american': ['Autores latinoamericanos'],
  'authors, argentine': ['Autores argentinos'],
  'argentine literature': ['Literatura argentina'],
  'argentine fiction': ['Ficción argentina'],
  'argentina': ['Argentina'],
};

/** Géneros en español de un libro. Valores nuevos no mapeados: se separan por coma. */
export function generosDe(genero: string | null | undefined): string[] {
  if (!genero?.trim()) return [];
  const crudo = genero.trim();
  const mapeado = GENEROS[crudo.toLocaleLowerCase('es')];
  if (mapeado) return [...mapeado];
  const partes = crudo.split(',').map((p) => p.trim()).filter(Boolean);
  return partes.length ? partes : [crudo];
}

/** Un solo género en español (para tablas/reportes donde no se quiere separar). */
export function traducirGenero(genero: string | null | undefined): string {
  return generosDe(genero).join(' · ');
}
