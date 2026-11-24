// Tipos del catálogo de libros (espejo de backend/app/dtos/libro_dto.py y googlebooks_dto.py).
// Cuando se regenere src/api/schema.d.ts con `npm run gen:types`, se pueden reemplazar por
// components['schemas']['LibroDTO'], etc.

export interface Autor {
  id: number;
  nombre: string;
}

/** GET /api/v1/libros/catalogo (listado) */
export interface LibroListado {
  id: number;
  nombre: string;
  editorial: string | null;
  isbn: string | null;
  imagen_url: string | null;
  genero: string | null;
  activo: boolean;
  autores: Autor[];
  sinopsis: string | null;
}

/** GET /api/v1/libros/catalogo/{id} (detalle) */
export interface Libro extends LibroListado {
  cant_paginas: number | null;
  /** ISO yyyy-mm-dd */
  fecha_publicacion: string | null;
  
}

/** Cuerpo de POST /api/v1/libros y PUT /api/v1/libros/{id} */
export interface LibroPayload {
  nombre: string;
  isbn: string | null;
  cant_paginas: number | null;
  editorial: string | null;
  fecha_publicacion: string | null;
  imagen_url: string | null;
  genero: string | null;
  /** Nombres: el backend reutiliza los autores existentes y crea los que falten */
  autores: string[];
  sinopsis: string | null;
}

/** Resultado del proxy de Google Books (GET /api/v1/libros/google?q=) */
export interface LibroGoogle {
  origen: 'LOCAL' | 'GOOGLE' | 'MANUAL';
  nombre: string | null;
  isbn: string | null;
  cant_paginas: number | null;
  editorial: string | null;
  fecha_publicacion: string | null;
  imagen_url: string | null;
  genero: string | null;
  autores: string[];
  sinopsis?: string | null;
}
