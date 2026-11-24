import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../services/api';
import { ejemplaresService } from '../../services/ejemplaresService';
import type { EjemplarInventario, Sede } from '../../types/ejemplares';
import type { LibroListado } from '../../types/libros';
import AdminIcon from '../admin/AdminIcon';
import LibroSelector from '../libros/LibroSelector';

interface Props {
  libros: LibroListado[];
  sedes: Sede[];
  libroInicial: number | null;
  sedeInicial: number | null;
  /** Si viene, la sede queda fija (el bibliotecario solo registra copias en su sede). */
  sedeFija: number | null;
  onCerrar: () => void;
  onCreados: (ejemplares: EjemplarInventario[]) => void;
}

const MAX_COPIAS = 50;

/** F6.2 – Alta rápida de una o más copias físicas de un libro en una sede inicial. */
export default function EjemplarAltaModal({
  libros,
  sedes,
  libroInicial,
  sedeInicial,
  sedeFija,
  onCerrar,
  onCreados,
}: Props) {
  const [libroId, setLibroId] = useState<number | null>(libroInicial);
  const [sedeId, setSedeId] = useState<number | null>(sedeFija ?? sedeInicial ?? sedes[0]?.id ?? null);
  const [cantidad, setCantidad] = useState(1);
  const [codigo, setCodigo] = useState('');
  const [signatura, setSignatura] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [errores, setErrores] = useState<{ libro?: string; sede?: string }>({});
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && !guardando && onCerrar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar, guardando]);

  const libro = libros.find((l) => l.id === libroId);
  const sede = sedes.find((s) => s.id === sedeId);
  const cambiarCantidad = (n: number) => setCantidad(Math.min(MAX_COPIAS, Math.max(1, Math.round(n) || 1)));

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const nuevos: typeof errores = {};
    if (!libroId) nuevos.libro = 'Elegí el libro.';
    if (!sedeId) nuevos.sede = 'Elegí la sede.';
    setErrores(nuevos);
    if (!libroId || !sedeId) return;

    setGuardando(true);
    setErrorApi(null);
    try {
      const creados = await ejemplaresService.crearLote({
        libro_id: libroId,
        sede_id: sedeId,
        cantidad,
        codigo_inventario: cantidad === 1 ? codigo.trim() || null : null,
        signatura_topografica: signatura.trim() || null,
        descripcion_fisica: descripcion.trim() || null,
      });
      onCreados(creados);
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
      <section className="reservation-modal" role="dialog" aria-modal="true" aria-labelledby="alta-ej-title">
        <button className="modal-close" onClick={onCerrar} aria-label="Cerrar" disabled={guardando}>
          <AdminIcon name="close" size={18} />
        </button>
        <span className="eyebrow">ALTA DE EJEMPLARES</span>
        <h2 id="alta-ej-title">Registrar copias físicas</h2>

        <form className="ejemplar-form" onSubmit={guardar} noValidate>
          <div className="campo">
            <span>Libro *</span>
            <LibroSelector
              libros={libros}
              value={libroId}
              onChange={(id) => {
                setLibroId(id);
                setErrores((x) => ({ ...x, libro: undefined }));
              }}
              limpiable={false}
              invalido={!!errores.libro}
              ariaLabel="Libro del ejemplar"
            />
            {errores.libro && <small className="campo-error">{errores.libro}</small>}
          </div>

          <div className="ejemplar-form-fila">
            <label className="campo">
              <span>Sede inicial *</span>
              <select
                value={sedeId ?? ''}
                onChange={(e) => setSedeId(e.target.value ? Number(e.target.value) : null)}
                aria-invalid={!!errores.sede}
                disabled={sedeFija !== null}
              >
                <option value="">Elegí una sede</option>
                {sedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
              {errores.sede && <small className="campo-error">{errores.sede}</small>}
              {sedeFija !== null && <small className="campo-ayuda">Registrás copias solo en tu sede.</small>}
            </label>

            <div className="campo">
              <span id="cantidad-label">Cantidad de copias</span>
              <div className="stepper" role="group" aria-labelledby="cantidad-label">
                <button type="button" onClick={() => cambiarCantidad(cantidad - 1)} disabled={cantidad <= 1} aria-label="Una copia menos">
                  −
                </button>
                <input
                  value={cantidad}
                  inputMode="numeric"
                  onChange={(e) => cambiarCantidad(Number(e.target.value))}
                  aria-labelledby="cantidad-label"
                />
                <button type="button" onClick={() => cambiarCantidad(cantidad + 1)} disabled={cantidad >= MAX_COPIAS} aria-label="Una copia más">
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="ejemplar-form-fila">
            <label className="campo">
              <span>Signatura topográfica</span>
              <input value={signatura} onChange={(e) => setSignatura(e.target.value)} placeholder="Ej. 863 COR r" />
            </label>
            <label className="campo">
              <span>Código de inventario</span>
              <input
                value={cantidad === 1 ? codigo : ''}
                onChange={(e) => setCodigo(e.target.value)}
                disabled={cantidad !== 1}
                placeholder={
                  libroId && sedeId ? `Automático: I-${sedeId}-${libroId}…` : 'Se genera automáticamente'
                }
              />
            </label>
          </div>

          <label className="campo">
            <span>Descripción física</span>
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej. Tapa blanda, buen estado"
            />
          </label>

          {libro && sede && (
            <p className="ejemplar-resumen">
              Se {cantidad === 1 ? 'va a crear 1 copia' : `van a crear ${cantidad} copias`} <b>disponibles</b> de{' '}
              <b>{libro.nombre}</b> en <b>{sede.nombre}</b>.
            </p>
          )}

          {errorApi && (
            <div className="login-error" role="alert">
              {errorApi}
            </div>
          )}

          <div className="modal-actions">
            <button type="submit" className="confirm-reservation" disabled={guardando}>
              {guardando ? 'REGISTRANDO…' : cantidad === 1 ? 'REGISTRAR EJEMPLAR' : `REGISTRAR ${cantidad} EJEMPLARES`}
            </button>
          </div>
            <button type="button" className="ghost-btn" style={{
                    width: '100%',
                    padding: '14px 18px',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 0,
                    background: '#e5e2dc',
                    color: '#3d433f',
                    border: '1px solid #c9c4ba',
                    cursor: 'pointer',
                  }} onClick={onCerrar} disabled={guardando}>
              Cancelar
            </button>
            
        </form>
      </section>
    </div>
  );
}
