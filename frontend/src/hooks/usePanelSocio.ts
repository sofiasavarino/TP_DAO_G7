import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../services/api';
import { prestamosService, sancionesService } from '../services/socioService';
import type { PrestamoSocio, Sancion } from '../types/socio';

function mensajeDeError(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Verificá que el backend esté levantado.';
}

/** F4.1 / F4.3 – Préstamos y sanciones vigentes del socio logueado. */
export function usePanelSocio(socioId: number | null | undefined) {
  const [prestamos, setPrestamos] = useState<PrestamoSocio[]>([]);
  const [sanciones, setSanciones] = useState<Sancion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorPrestamos, setErrorPrestamos] = useState<string | null>(null);
  const [errorSanciones, setErrorSanciones] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!socioId) {
      setCargando(false);
      return;
    }
    setCargando(true);
    // Por separado: si falla uno, el otro igual se muestra
    const [p, s] = await Promise.allSettled([
      prestamosService.mios(socioId),
      sancionesService.vigentes(socioId),
    ]);
    if (p.status === 'fulfilled') {
      setPrestamos(p.value);
      setErrorPrestamos(null);
    } else setErrorPrestamos(mensajeDeError(p.reason));
    if (s.status === 'fulfilled') {
      setSanciones(s.value);
      setErrorSanciones(null);
    } else setErrorSanciones(mensajeDeError(s.reason));
    setCargando(false);
  }, [socioId]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { prestamos, sanciones, cargando, errorPrestamos, errorSanciones, recargar };
}
