import type { LibroListado } from '../types/libros';

/** "Borges, Bioy Casares" (o "Autor desconocido"). */
export function nombresAutores(libro: Pick<LibroListado, 'autores'>): string {
  return libro.autores.map((a) => a.nombre).join(', ') || 'Autor desconocido';
}
