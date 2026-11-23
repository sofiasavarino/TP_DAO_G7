import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ApiError } from '../../services/api';
import { librosService } from '../../services/librosService';
import type { Libro, LibroGoogle, LibroListado, LibroPayload } from '../../types/libros';
import { isbnValido, limpiarIsbn } from '../../utils/texto';
import AdminIcon from '../admin/AdminIcon';
import GoogleBooksBuscador from './GoogleBooksBuscador';

interface Props {
  /** null = alta; un libro = edición */
  libro: Libro | null;
  librosExistentes: LibroListado[];
  onCerrar: () => void;
  onGuardado: (libro: Libro, eraEdicion: boolean) => void;
  /** Al detectar un ISBN repetido en el alta, permite saltar a editar el existente. */
  onEditarExistente: (libro: LibroListado) => void;
}

interface Campos {
  nombre: string;
  autores: string[];
  isbn: string;
  editorial: string;
  genero: string;
  cant_paginas: string;
  fecha_publicacion: string;
  imagen_url: string;
}

const VACIO: Campos = {
  nombre: '',
  autores: [],
  isbn: '',
  editorial: '',
  genero: '',
  cant_paginas: '',
  fecha_publicacion: '',
  imagen_url: '',
};

function desdeLibro(l: Libro): Campos {
  return {
    nombre: l.nombre,
    autores: l.autores.map((a) => a.nombre),
    isbn: l.isbn ?? '',
    editorial: l.editorial ?? '',
    genero: l.genero ?? '',
    cant_paginas: l.cant_paginas != null ? String(l.cant_paginas) : '',
    fecha_publicacion: l.fecha_publicacion ?? '',
    imagen_url: l.imagen_url ?? '',
  };
}

function desdeGoogle(r: LibroGoogle): Campos {
  return {
    nombre: r.nombre ?? '',
    autores: r.autores,
    isbn: r.isbn ?? '',
    editorial: r.editorial ?? '',
    genero: r.genero ?? '',
    cant_paginas: r.cant_paginas != null ? String(r.cant_paginas) : '',
    fecha_publicacion: r.fecha_publicacion ?? '',
    imagen_url: r.imagen_url ?? '',
  };
}

const textoONull = (v: string) => v.trim() || null;

/**
 * F5.4 – Alta / edición de un libro. En el alta, el buscador de Google Books
 * autocompleta título, autores, ISBN y el resto de los datos; todo se puede
 * corregir o cargar a mano antes de guardar.
 */
export default function LibroFormModal({ libro, librosExistentes, onCerrar, onGuardado, onEditarExistente }: Props) {
  const esEdicion = libro !== null;
  const [campos, setCampos] = useState<Campos>(() => (libro ? desdeLibro(libro) : VACIO));
  const [autorNuevo, setAutorNuevo] = useState('');
  const [mostrarBuscador, setMostrarBuscador] = useState(!esEdicion);
  const [desdeGoogleBooks, setDesdeGoogleBooks] = useState(false);
  const [errores, setErrores] = useState<Partial<Record<keyof Campos, string>>>({});
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Cerrar con Escape
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && !guardando && onCerrar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar, guardando]);

  const isbnsEnCatalogo = useMemo(
    () => new Set(librosExistentes.map((l) => limpiarIsbn(l.isbn)).filter((i): i is string => i !== null)),
    [librosExistentes],
  );

  // ¿El ISBN cargado ya pertenece a otro libro del catálogo?
  const isbnActual = limpiarIsbn(campos.isbn);
  const duplicado = isbnActual
    ? librosExistentes.find((l) => limpiarIsbn(l.isbn) === isbnActual && l.id !== libro?.id)
    : undefined;

  const set = <K extends keyof Campos>(clave: K, valor: Campos[K]) => {
    setCampos((c) => ({ ...c, [clave]: valor }));
    setErrores((e) => ({ ...e, [clave]: undefined }));
  };

  const usarResultado = (r: LibroGoogle) => {
    setCampos(desdeGoogle(r));
    setErrores({});
    setErrorApi(null);
    setDesdeGoogleBooks(true);
  };

  const agregarAutor = () => {
    const nombre = autorNuevo.trim().replace(/,$/, '').trim();
    if (!nombre) return;
    if (!campos.autores.some((a) => a.toLowerCase() === nombre.toLowerCase())) {
      set('autores', [...campos.autores, nombre]);
    }
    setAutorNuevo('');
  };

  const onKeyAutor = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      agregarAutor();
    } else if (e.key === 'Backspace' && !autorNuevo && campos.autores.length) {
      set('autores', campos.autores.slice(0, -1));
    }
  };

  const validar = (): boolean => {
    const nuevos: typeof errores = {};
    if (!campos.nombre.trim()) nuevos.nombre = 'El título es obligatorio.';
    if (isbnActual && !isbnValido(isbnActual)) nuevos.isbn = 'Debe tener 10 o 13 dígitos (se ignoran los guiones).';
    if (esEdicion && duplicado) nuevos.isbn = `Ese ISBN ya lo tiene "${duplicado.nombre}".`;
    const paginas = campos.cant_paginas.trim();
    if (paginas && (!/^\d+$/.test(paginas) || Number(paginas) <= 0)) nuevos.cant_paginas = 'Número entero mayor a 0.';
    if (campos.imagen_url.trim() && !/^https?:\/\//i.test(campos.imagen_url.trim()))
      nuevos.imagen_url = 'Tiene que empezar con http:// o https://';
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setErrorApi(null);
    // El autor que quedó escrito sin confirmar también cuenta
    const autores = autorNuevo.trim() ? [...campos.autores, autorNuevo.trim()] : campos.autores;
    if (!validar()) return;

    const payload: LibroPayload = {
      nombre: campos.nombre.trim(),
      autores,
      isbn: isbnActual,
      editorial: textoONull(campos.editorial),
      genero: textoONull(campos.genero),
      cant_paginas: campos.cant_paginas.trim() ? Number(campos.cant_paginas) : null,
      fecha_publicacion: campos.fecha_publicacion || null,
      imagen_url: textoONull(campos.imagen_url),
    };

    setGuardando(true);
    try {
      const guardado = esEdicion
        ? await librosService.actualizar(libro.id, payload)
        : await librosService.crear(payload);
      onGuardado(guardado, esEdicion);
    } catch (err) {
      setErrorApi(
        err instanceof ApiError
          ? err.message
          : 'No se pudo conectar con el servidor. Verificá que el backend esté levantado.',
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="reservation-modal-backdrop" role="presentation">
      <section className="reservation-modal libro-modal" role="dialog" aria-modal="true" aria-labelledby="libro-form-title">
        <button className="modal-close" onClick={onCerrar} aria-label="Cerrar" disabled={guardando}>
          <AdminIcon name="close" size={18} />
        </button>
        <span className="eyebrow">{esEdicion ? 'EDITAR LIBRO' : 'ALTA DE LIBRO'}</span>
        <h2 id="libro-form-title">{esEdicion ? libro.nombre : 'Agregar un libro al catálogo'}</h2>

        {mostrarBuscador ? (
          <GoogleBooksBuscador
            isbnsEnCatalogo={isbnsEnCatalogo}
            onSeleccionar={usarResultado}
            consultaInicial={esEdicion ? libro.nombre : ''}
          />
        ) : (
          <button type="button" className="gb-toggle" onClick={() => setMostrarBuscador(true)}>
            <AdminIcon name="globe" size={17} />
            Completar con datos de Google Books
          </button>
        )}

        <form className="libro-form" onSubmit={guardar} noValidate>
          <div className="libro-form-head">
            <h3>Datos del libro</h3>
            {desdeGoogleBooks ? (
              <em className="badge ok">Completado desde Google Books · podés corregirlo</em>
            ) : (
              !esEdicion && <small className="muted">o cargalo manualmente</small>
            )}
          </div>

          {duplicado && !esEdicion && (
            <div className="fine-alert libro-duplicado" role="status">
              <span>
                “{duplicado.nombre}” ya está en el catálogo con este ISBN. Si guardás, no se duplica: se usa el
                existente.
              </span>
              <button type="button" className="ghost-btn" onClick={() => onEditarExistente(duplicado)}>
                Editar ese libro
              </button>
            </div>
          )}

          <div className="libro-form-grid">
            <div className="libro-form-cover">
              {campos.imagen_url.trim() ? (
                <img src={campos.imagen_url} alt="Vista previa de la portada" />
              ) : (
                <span className="admin-cover-vacia grande" aria-hidden="true">
                  {campos.nombre.charAt(0) || '?'}
                </span>
              )}
            </div>

            <div className="libro-form-campos">
              <label className="full">
                Título *
                <input
                  value={campos.nombre}
                  onChange={(e) => set('nombre', e.target.value)}
                  aria-invalid={!!errores.nombre}
                  required
                />
                {errores.nombre && <small className="campo-error">{errores.nombre}</small>}
              </label>

              <div className="full campo">
                <span id="autores-label">Autores</span>
                <div className="chips-input" onClick={() => document.getElementById('autor-input')?.focus()}>
                  {campos.autores.map((a) => (
                    <span key={a} className="chip">
                      {a}
                      <button
                        type="button"
                        onClick={() => set('autores', campos.autores.filter((x) => x !== a))}
                        aria-label={`Quitar ${a}`}
                      >
                        <AdminIcon name="close" size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    id="autor-input"
                    aria-labelledby="autores-label"
                    value={autorNuevo}
                    onChange={(e) => setAutorNuevo(e.target.value)}
                    onKeyDown={onKeyAutor}
                    onBlur={agregarAutor}
                    placeholder={campos.autores.length ? '' : 'Escribí un nombre y presioná Enter'}
                  />
                </div>
              </div>

              <label>
                ISBN
                <input
                  value={campos.isbn}
                  onChange={(e) => set('isbn', e.target.value)}
                  inputMode="numeric"
                  placeholder="978…"
                  aria-invalid={!!errores.isbn}
                />
                {errores.isbn && <small className="campo-error">{errores.isbn}</small>}
              </label>

              <label>
                Editorial
                <input value={campos.editorial} onChange={(e) => set('editorial', e.target.value)} />
              </label>

              <label>
                Género
                <input value={campos.genero} onChange={(e) => set('genero', e.target.value)} />
              </label>

              <label>
                Páginas
                <input
                  value={campos.cant_paginas}
                  onChange={(e) => set('cant_paginas', e.target.value)}
                  inputMode="numeric"
                  aria-invalid={!!errores.cant_paginas}
                />
                {errores.cant_paginas && <small className="campo-error">{errores.cant_paginas}</small>}
              </label>

              <label>
                Fecha de publicación
                <input
                  type="date"
                  value={campos.fecha_publicacion}
                  onChange={(e) => set('fecha_publicacion', e.target.value)}
                />
              </label>

              <label>
                URL de la portada
                <input
                  value={campos.imagen_url}
                  onChange={(e) => set('imagen_url', e.target.value)}
                  placeholder="https://…"
                  aria-invalid={!!errores.imagen_url}
                />
                {errores.imagen_url && <small className="campo-error">{errores.imagen_url}</small>}
              </label>
            </div>
          </div>

          {errorApi && (
            <div className="login-error" role="alert">
              {errorApi}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" className="confirm-reservation" disabled={guardando}>
              {guardando ? 'GUARDANDO…' : esEdicion ? 'GUARDAR CAMBIOS' : 'AGREGAR AL CATÁLOGO'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
