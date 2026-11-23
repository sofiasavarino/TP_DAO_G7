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
