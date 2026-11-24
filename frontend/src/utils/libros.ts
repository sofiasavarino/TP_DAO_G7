import type { LibroListado } from '../types/libros';
import { autorLegible } from './autores';

/** "Borges, Bioy Casares" (o "Autor desconocido"), con los nombres normalizados. */
export function nombresAutores(libro: Pick<LibroListado, 'autores'>): string {
  return libro.autores.map((a) => autorLegible(a.nombre)).join(', ') || 'Autor desconocido';
}
