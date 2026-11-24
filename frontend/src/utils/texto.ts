/** Minúsculas y sin tildes, para búsquedas locales ("garcia" encuentra "García"). */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** ISBN sin guiones ni espacios; vacío -> null. */
export function limpiarIsbn(isbn: string | null | undefined): string | null {
  const limpio = (isbn ?? '').replace(/[-\s]/g, '').toUpperCase();
  return limpio || null;
}

/** ISBN-10 o ISBN-13 con formato válido (dígitos y X final en el de 10). */
export function isbnValido(isbn: string): boolean {
  return /^(\d{9}[\dX]|\d{13})$/.test(isbn);
}

export function anio(fechaIso: string | null | undefined): string {
  return fechaIso ? fechaIso.slice(0, 4) : '';
}

/** Si la sinopsis viene bilingüe desde Google Books ("... ENGLISH DESCRIPTION ..."), deja solo la parte en español. */
export function limpiarSinopsis(sinopsis: string | null | undefined): string {
  if (!sinopsis) return '';
  return sinopsis
    .split(/\s*(?:ENGLISH DESCRIPTION|DESCRIPTION IN ENGLISH|ENGLISH VERSION)\s*:?\s*/i)[0]
    .trim();
}
