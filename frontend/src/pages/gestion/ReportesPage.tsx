import { useCallback, useEffect, useState } from 'react';
import { mensajeDeError } from '../../components/mostrador/avisos';
import { librosService } from '../../services/librosService';
import { reportesService } from '../../services/reportesService';
import type { LibroListado } from '../../types/libros';
import type {
  CargaSede,
  CumplimientoRetiro,
  DisponibilidadSede,
  EficaciaLogistica,
  EstadoColeccion,
  EsperaReserva,
  LibroSolicitado,
  MovimientoSede,
  MultasAcumuladas,
  PresionLibro,
  UsoGeneroSede,
  VencidosSinSancion,
} from '../../types/reportes';
import './reportes.css';

interface Datos {
  disponibilidad: DisponibilidadSede[];
  eficacia: EficaciaLogistica;
  movimientos: MovimientoSede[];
  libros: LibroSolicitado[];
  salud: EstadoColeccion[];
  cumplimiento: CumplimientoRetiro;
  espera: EsperaReserva[];
  carga: CargaSede[];
  multas: MultasAcumuladas;
  presion: PresionLibro[];
  uso: UsoGeneroSede[];
  vencidos: VencidosSinSancion;
}

function Kpi({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="rep-kpi">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      {nota && <small>{nota}</small>}
    </div>
  );
}

function Barras({ items }: { items: { label: string; valor: number; extra?: string }[] }) {
  if (!items.length) return <p className="rep-vacio">Sin datos para el período.</p>;
  const max = Math.max(...items.map((i) => i.valor), 1);
  return (
    <div className="rep-barras">
      {items.map((item) => (
        <div className="rep-barra" key={item.label}>
          <span className="rep-barra-label">{item.label}</span>
          <div className="rep-barra-pista">
            <div className="rep-barra-relleno" style={{ width: `${(item.valor / max) * 100}%` }} />
          </div>
          <strong>{item.extra ?? item.valor}</strong>
        </div>
      ))}
    </div>
  );
}

const COLORES = ['#1f6b47', '#bc5a38', '#c48c28', '#4a6c8c', '#7a5470', '#6f746f', '#8ba36a'];

function Dona({ items }: { items: { label: string; valor: number; porcentaje: number; cantidad: number }[] }) {
  let acumulado = 0;
  return (
    <div className="rep-dona">
      <svg viewBox="0 0 42 42" className="rep-dona-svg" role="img" aria-label="Estado del inventario">
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#e9e1d3" strokeWidth="6" />
        {items.map((item, i) => {
          const offset = acumulado;
          acumulado += item.porcentaje;
          return (
            <circle
              key={item.label}
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke={COLORES[i % COLORES.length]}
              strokeWidth="6"
              pathLength={100}
              strokeDasharray={`${item.porcentaje} ${100 - item.porcentaje}`}
              strokeDashoffset={-offset}
            />
          );
        })}
      </svg>
      <ul className="rep-leyenda">
        {items.map((item, i) => (
          <li key={item.label}>
            <i style={{ background: COLORES[i % COLORES.length] }} />
            <span>{item.label}</span>
            <strong>{item.cantidad} ({item.porcentaje}%)</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tabla({ columnas, filas }: { columnas: string[]; filas: (string | number)[][] }) {
  if (!filas.length) return <p className="rep-vacio">Sin datos para el período.</p>;
  return (
    <div className="rep-tabla-wrap">
      <table className="rep-tabla">
        <thead>
          <tr>{columnas.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i}>
              {fila.map((celda, j) => <td key={j}>{celda}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const fmt = (n: number | null) => (n === null ? '—' : String(n));

/** Panel de reportes (solo Administrador: lo valida el backend y la ruta en GestionPage). */
export default function ReportesPage() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [libroBusqueda, setLibroBusqueda] = useState('');
  const [libroId, setLibroId] = useState<number | null>(null);
  const [libroLabel, setLibroLabel] = useState('');
  const [sugerencias, setSugerencias] = useState<LibroListado[]>([]);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const filtro = { desde: desde || undefined, hasta: hasta || undefined };
    try {
      const [
        disponibilidad, eficacia, movimientos, libros, salud, cumplimiento,
        espera, carga, multas, presion, uso, vencidos,
      ] = await Promise.all([
        reportesService.disponibilidad(libroId ?? undefined),
        reportesService.eficacia(filtro),
        reportesService.movimientos(filtro),
        reportesService.librosSolicitados(),
        reportesService.saludColeccion(),
        reportesService.cumplimiento(filtro),
        reportesService.esperaReservas(filtro),
        reportesService.cargaOperativa(),
        reportesService.multas(filtro),
        reportesService.presionLibros(),
        reportesService.usoGenero(filtro),
        reportesService.vencidosSinSancion(),
      ]);
      setDatos({
        disponibilidad, eficacia, movimientos, libros, salud, cumplimiento,
        espera, carga, multas, presion, uso, vencidos,
      });
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudieron cargar los reportes.'));
    } finally {
      setCargando(false);
    }
  }, [desde, hasta, libroId]);

  // Autocompletado: texto con dígitos se busca como ISBN; si no, como título.
  useEffect(() => {
    const texto = libroBusqueda.trim();
    if (texto.length < 2 || libroId !== null) {
      setSugerencias([]);
      return;
    }
    const esIsbn = /^[0-9-]{8,}$/.test(texto);
    const t = window.setTimeout(() => {
      librosService
        .listar(esIsbn ? { isbn: texto } : { titulo: texto })
        .then((libros) => setSugerencias(libros.slice(0, 6)))
        .catch(() => setSugerencias([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [libroBusqueda, libroId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="rep-page">
      <div className="rep-cabecera">
        <div>
          <span className="eyebrow">PANEL DE GESTIÓN</span>
          <h1>Reportes</h1>
          <p>Indicadores de catálogo, logística, reservas y sanciones.</p>
        </div>
        <button className="admin-btn" onClick={() => void cargar()} disabled={cargando}>
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      <div className="rep-filtros">
        <label>
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <label className="rep-libro">
          Libro (título o ISBN)
          <input
            type="text"
            placeholder="Buscar en el catálogo…"
            value={libroBusqueda}
            onChange={(e) => setLibroBusqueda(e.target.value)}
            disabled={libroId !== null}
          />
          {sugerencias.length > 0 && (
            <ul className="rep-sugerencias">
              {sugerencias.map((libro) => (
                <li key={libro.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setLibroId(libro.id);
                      setLibroLabel(libro.nombre);
                      setLibroBusqueda('');
                      setSugerencias([]);
                    }}
                  >
                    <strong>{libro.nombre}</strong>
                    <small>{libro.isbn ?? 'sin ISBN'}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>
        {libroId !== null && (
          <div className="rep-libro-elegido">
            <span>{libroLabel}</span>
            <button
              type="button"
              onClick={() => {
                setLibroId(null);
                setLibroLabel('');
              }}
            >
              Quitar filtro
            </button>
          </div>
        )}
      </div>

      {error && <div className="rep-error">{error}</div>}

      {datos && !cargando && (
        <>
          <div className="rep-kpis">
            <Kpi
              titulo="Éxito en envíos"
              valor={`${datos.eficacia.tasa_exito_porcentaje}%`}
              nota={`${datos.eficacia.recibidos} recibidos / ${datos.eficacia.finalizados} cerrados`}
            />
            <Kpi
              titulo="Retiro de reservas"
              valor={`${datos.cumplimiento.tasa_cumplimiento_porcentaje}%`}
              nota={`${datos.cumplimiento.cumplidas} cumplidas · ${datos.cumplimiento.vencidas} vencidas`}
            />
            <Kpi
              titulo="Total de multas"
              valor={`$${datos.multas.total.toLocaleString('es-AR')}`}
              nota={`${datos.multas.socios.length} socios con multas`}
            />
            <Kpi
              titulo="Vencidos sin sanción"
              valor={String(datos.vencidos.cantidad)}
              nota="Requieren aplicación de sanción"
            />
          </div>

          <div className="rep-grid">
            <section className="rep-card">
              <h2>Disponibilidad por sede</h2>
              <Barras
                items={datos.disponibilidad.map((d) => ({
                  label: d.sede,
                  valor: d.porcentaje,
                  extra: `${d.disponibles}/${d.total} (${d.porcentaje}%)`,
                }))}
              />
            </section>

            <section className="rep-card">
              <h2>Salud de la colección</h2>
              <Dona
                items={datos.salud
                  .filter((s) => s.cantidad > 0)
                  .map((s) => ({ label: s.estado, valor: s.cantidad, porcentaje: s.porcentaje, cantidad: s.cantidad }))}
              />
            </section>

            <section className="rep-card">
              <h2>Carga operativa por sede</h2>
              <Tabla
                columnas={['Sede', 'Préstamos activos', 'Remitos en tránsito', 'Ejemplares en viaje']}
                filas={datos.carga.map((c) => [
                  c.sede, c.prestamos_activos, c.remitos_en_transito, c.ejemplares_en_transito,
                ])}
              />
            </section>

            <section className="rep-card">
              <h2>Movimientos entre sedes</h2>
              <Tabla
                columnas={['Origen', 'Destino', 'Remitos', 'Ejemplares', 'Días promedio']}
                filas={datos.movimientos.map((m) => [
                  m.origen, m.destino, m.remitos, m.ejemplares, fmt(m.dias_promedio),
                ])}
              />
            </section>

            <section className="rep-card">
              <h2>Libros más solicitados</h2>
              <Barras
                items={datos.libros.map((l) => ({ label: l.libro, valor: l.cantidad }))}
              />
            </section>

            <section className="rep-card">
              <h2>Presión por título (reservas por ejemplar)</h2>
              <Tabla
                columnas={['Libro', 'Reservas en cola', 'Ejemplares', 'Ratio']}
                filas={datos.presion.map((p) => [
                  p.libro, p.reservas_esperando, p.ejemplares, p.ratio,
                ])}
              />
            </section>

            <section className="rep-card">
              <h2>Espera de reservas por sede</h2>
              <Tabla
                columnas={['Sede', 'Reservas asignadas', 'Días promedio']}
                filas={datos.espera.map((e) => [e.sede, e.reservas, fmt(e.dias_promedio)])}
              />
            </section>

            <section className="rep-card">
              <h2>Uso por género y sede</h2>
              <Tabla
                columnas={['Género', 'Sede', 'Préstamos']}
                filas={datos.uso.map((u) => [u.genero, u.sede, u.prestamos])}
              />
            </section>

            <section className="rep-card">
              <h2>Multas acumuladas por socio</h2>
              <Tabla
                columnas={['Socio', 'Cantidad', 'Monto total']}
                filas={datos.multas.socios.map((m) => [
                  m.socio, m.cantidad, `$${m.monto_total.toLocaleString('es-AR')}`,
                ])}
              />
            </section>

            <section className="rep-card">
              <h2>Vencidos sin sanción</h2>
              <Tabla
                columnas={['Préstamo', 'Socio', 'Libro', 'Vencimiento']}
                filas={datos.vencidos.prestamos.map((v) => [
                  v.numero, v.socio, v.libro, v.fecha_vencimiento,
                ])}
              />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
