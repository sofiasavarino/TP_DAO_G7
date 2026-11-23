import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminIcon from '../../components/admin/AdminIcon';
import { mensajeDeError, type Aviso } from '../../components/mostrador/avisos';
import PrestamoDirectoForm from '../../components/mostrador/PrestamoDirectoForm';
import PrestamosActivosPanel from '../../components/mostrador/PrestamosActivosPanel';
import ReservasListasPanel from '../../components/mostrador/ReservasListasPanel';
import { useAuth } from '../../context/AuthContext';
import { ejemplaresService, sedesService } from '../../services/ejemplaresService';
import { librosService } from '../../services/librosService';
import type { EjemplarInventario, Sede } from '../../types/ejemplares';
import { RolNombre } from '../../types/enums';
import type { LibroListado } from '../../types/libros';
import './mostrador.css';

type Vista = 'retiros' | 'prestamo' | 'devoluciones';

const VISTAS: { id: Vista; texto: string; ayuda: string }[] = [
  { id: 'retiros', texto: 'Retiros de reservas', ayuda: 'Reservas listas para entregar en esta sede' },
  { id: 'prestamo', texto: 'Préstamo directo', ayuda: 'Prestar un ejemplar disponible a un socio' },
  { id: 'devoluciones', texto: 'Préstamos y devoluciones', ayuda: 'Préstamos en curso de toda la red' },
];

/**
 * F7 – Mostrador: (1) entrega de reservas listas para retiro, (2) préstamo directo y
 * (3) préstamos en curso con registro de devoluciones. El bibliotecario atiende en su
 * sede; el administrador puede elegir en qué sede está atendiendo.
 */
export default function MostradorPage() {
  const { usuario, rol } = useAuth();
  const esAdmin = rol === RolNombre.ADMINISTRADOR;
  const [params, setParams] = useSearchParams();
  const vista: Vista = VISTAS.some((v) => v.id === params.get('vista')) ? (params.get('vista') as Vista) : 'retiros';

  const [sedeElegida, setSedeElegida] = useState<number | null>(null);
  const sedeId = sedeElegida ?? usuario?.sede.id ?? null;

  const [libros, setLibros] = useState<LibroListado[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [ejemplares, setEjemplares] = useState<EjemplarInventario[]>([]);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  // Se incrementa cuando una acción cambia datos que muestran otros bloques (préstamos, inventario)
  const [version, setVersion] = useState(0);
  const [conteoRetiros, setConteoRetiros] = useState<number | null>(null);
  const [conteoPrestamos, setConteoPrestamos] = useState<number | null>(null);

  // Catálogo y sedes, una sola vez (para nombres y portadas)
  useEffect(() => {
    Promise.all([librosService.listar(), sedesService.listar()])
      .then(([l, s]) => {
        setLibros(l);
        setSedes(s);
      })
      .catch((e) => setAviso({ tipo: 'error', texto: mensajeDeError(e, 'No se pudieron cargar libros y sedes.') }));
  }, []);

  // Inventario de toda la red: ejemplares disponibles para prestar y datos de cada copia
  useEffect(() => {
    ejemplaresService
      .listar()
      .then(setEjemplares)
      .catch((e) => setAviso({ tipo: 'error', texto: mensajeDeError(e, 'No se pudo cargar el inventario.') }));
  }, [version]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 6000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const refrescar = useCallback(() => setVersion((v) => v + 1), []);
  const cambiarVista = (v: Vista) => setParams(v === 'retiros' ? {} : { vista: v }, { replace: true });

  const sedeNombre = sedes.find((s) => s.id === sedeId)?.nombre ?? usuario?.sede.nombre ?? '';
  const conteos: Record<Vista, number | null> = {
    retiros: conteoRetiros,
    prestamo: null,
    devoluciones: conteoPrestamos,
  };

  if (sedeId === null || !usuario) {
    return (
      <section className="admin-page">
        <div className="admin-empty">
          <h3>Cargando sesión…</h3>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <span className="eyebrow">ATENCIÓN AL PÚBLICO</span>
          <h1>
            Mostrador {sedeNombre && <>de <em>{sedeNombre}</em></>}
          </h1>
          <p className="muted">{VISTAS.find((v) => v.id === vista)?.ayuda}</p>
        </div>
        {esAdmin && sedes.length > 0 && (
          <label className="inv-select mos-sede">
            <span>Atendiendo en</span>
            <select value={sedeId} onChange={(e) => setSedeElegida(Number(e.target.value))}>
              {sedes
                .filter((s) => s.activo)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                    {s.id === usuario.sede.id ? ' (mi sede)' : ''}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>

      {aviso && (
        <div className={`admin-aviso ${aviso.tipo}`} role={aviso.tipo === 'error' ? 'alert' : 'status'}>
          <AdminIcon name={aviso.tipo === 'ok' ? 'check' : 'close'} size={18} />
          <span>{aviso.texto}</span>
          <button onClick={() => setAviso(null)} aria-label="Cerrar aviso">
            <AdminIcon name="close" size={15} />
          </button>
        </div>
      )}

      <div className="mos-tabs" role="tablist" aria-label="Bloques del mostrador">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={vista === v.id}
            className={vista === v.id ? 'activo' : ''}
            onClick={() => cambiarVista(v.id)}
          >
            {v.texto}
            {conteos[v.id] !== null && <b>{conteos[v.id]}</b>}
          </button>
        ))}
      </div>

      {/* Los tres bloques quedan montados: así los contadores de las pestañas están siempre al día */}
      <div role="tabpanel" hidden={vista !== 'retiros'}>
        <ReservasListasPanel
          sedeId={sedeId}
          usuarioId={usuario.id}
          libros={libros}
          ejemplares={ejemplares}
          version={version}
          onAviso={setAviso}
          onCambio={refrescar}
          onConteo={setConteoRetiros}
        />
      </div>
      <div role="tabpanel" hidden={vista !== 'prestamo'}>
        <PrestamoDirectoForm
          key={sedeId}
          sedeId={sedeId}
          sedeNombre={sedeNombre}
          libros={libros}
          ejemplares={ejemplares}
          onAviso={setAviso}
          onCambio={refrescar}
        />
      </div>
      <div role="tabpanel" hidden={vista !== 'devoluciones'}>
        <PrestamosActivosPanel
          sedeId={sedeId}
          sedeNombre={sedeNombre}
          usuarioId={usuario.id}
          ejemplares={ejemplares}
          version={version}
          onAviso={setAviso}
          onCambio={refrescar}
          onConteo={setConteoPrestamos}
        />
      </div>
    </section>
  );
}
