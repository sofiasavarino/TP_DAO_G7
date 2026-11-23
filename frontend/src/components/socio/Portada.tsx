import { useEffect, useState } from 'react';

/**
 * Google Books solo devuelve miniaturas (~128 px) en sus búsquedas. Sus URLs aceptan
 * `fife=w<ancho>-h<alto>` para pedir la misma tapa en alta resolución; también se saca
 * `edge=curl` (la esquina doblada). Sirve para las URLs que ya están guardadas en la base.
 */
export function portadaEnAltaCalidad(url: string): string {
  if (!/books\.google|googleusercontent/.test(url)) return url;
  const limpia = url.replace(/&edge=curl/g, '').replace(/&fife=[^&]*/g, '');
  return `${limpia}&fife=w800-h1200`;
}

/** Tapa de Open Library por ISBN (sin API key). `default=false` → 404 si no la tiene. */
const openLibrary = (isbn: string) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;

/** Por debajo de este ancho (px) la tapa se ve pixelada en la ficha y el destacado. */
const ANCHO_MINIMO = 300;

/**
 * Tapa del libro. Prueba en orden:
 * 1. `src` en alta calidad (si es de Google Books) y, si falla, la miniatura original;
 * 2. Open Library por ISBN, si el libro tiene ISBN;
 * 3. una tapa tipográfica con el título, para no dejar el hueco vacío.
 * Si una imagen no carga (link roto, 404) o es de baja resolución, prueba la siguiente.
 * Si ninguna es mejor, se queda con la más grande que haya cargado.
 */
export default function Portada({
  src,
  isbn,
  titulo,
  className = '',
}: {
  src: string | null | undefined;
  isbn?: string | null;
  titulo: string;
  className?: string;
}) {
  const candidatas = [
    src ? portadaEnAltaCalidad(src) : null,
    src,
    isbn ? openLibrary(isbn) : null,
  ].filter((u, i, todas): u is string => !!u && todas.indexOf(u) === i);
  const [intento, setIntento] = useState(0);
  // La mejor imagen chica que cargó, por si ninguna de las siguientes es mejor
  const [respaldo, setRespaldo] = useState<{ url: string; ancho: number } | null>(null);

  // Si cambia el libro, se vuelve a empezar por la primera opción
  useEffect(() => {
    setIntento(0);
    setRespaldo(null);
  }, [src, isbn]);

  const url = candidatas[intento] ?? respaldo?.url;
  if (url) {
    const esUltima = intento >= candidatas.length - 1;
    return (
      <img
        className={className}
        src={url}
        alt={`Portada de ${titulo}`}
        loading="lazy"
        onLoad={(e) => {
          const ancho = e.currentTarget.naturalWidth;
          if (ancho >= ANCHO_MINIMO || url === respaldo?.url) return;
          if (esUltima) {
            // La última también es chica: si la de respaldo era más grande, volvemos a esa
            if (respaldo && respaldo.ancho > ancho) setIntento(candidatas.length);
            return;
          }
          // Baja resolución: la guardamos de respaldo y probamos la siguiente fuente
          if (!respaldo || ancho > respaldo.ancho) setRespaldo({ url, ancho });
          setIntento((n) => n + 1);
        }}
        onError={() => setIntento((n) => n + 1)}
      />
    );
  }
  return (
    <div className={`portada-vacia ${className}`} role="img" aria-label={`Portada de ${titulo}`}>
      <span>{titulo}</span>
    </div>
  );
}
