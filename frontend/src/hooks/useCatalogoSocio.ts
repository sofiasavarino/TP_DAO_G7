import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../services/api';
import { ejemplaresService, sedesService } from '../services/ejemplaresService';
import { librosService, type FiltroLibrosParams } from '../services/librosService';
import type { Sede } from '../types/ejemplares';
import type { LibroListado } from '../types/libros';
import { agruparDisponibles, type Disponibilidad } from '../utils/disponibilidad';

type Orden = NonNullable<FiltroLibrosParams['orden']>;

function mensajeDeError(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return 'No pudimos cargar el catálogo. Verificá que el backend esté levantado.';
}

/**
 * Datos reales del portal de socios (F3.2 / F3.3):
 * - libros activos del catálogo (el orden lo resuelve el backend),
 * - sedes activas,
 * - disponibilidad: copias DISPONIBLE por libro y sede.
 */
export function useCatalogoSocio(orden: Orden) {
  const [libros, setLibros] = useState<LibroListado[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad>(new Map());
  const [cargandoLibros, setCargandoLibros] = useState(true);
  const [cargandoInventario, setCargandoInventario] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  // Libros: se vuelven a pedir cuando cambia el orden
  useEffect(() => {
    let vigente = true;
    setCargandoLibros(true);
    librosService
      .listar({ orden })
      .then((data) => vigente && setLibros(data))
      .catch((e) => vigente && setError(mensajeDeError(e)))
      .finally(() => vigente && setCargandoLibros(false));
    return () => {
      vigente = false;
    };
  }, [orden, intento]);

  // Sedes y disponibilidad: una vez (y al reintentar)
  useEffect(() => {
    let vigente = true;
    setCargandoInventario(true);
    Promise.all([sedesService.listar(), ejemplaresService.disponibles()])
      .then(([sedesData, ejemplares]) => {
        if (!vigente) return;
        setSedes(sedesData.filter((s) => s.activo));
        setDisponibilidad(agruparDisponibles(ejemplares));
      })
      .catch((e) => vigente && setError(mensajeDeError(e)))
      .finally(() => vigente && setCargandoInventario(false));
    return () => {
      vigente = false;
    };
  }, [intento]);

  const reintentar = useCallback(() => {
    setError(null);
    setIntento((n) => n + 1);
  }, []);

  /** Tras reservar, la copia asignada deja de estar DISPONIBLE: refrescamos los contadores. */
  const recargarDisponibilidad = useCallback(async () => {
    try {
      setDisponibilidad(agruparDisponibles(await ejemplaresService.disponibles()));
    } catch {
      // Si falla, quedan los contadores anteriores; no bloquea al socio
    }
  }, []);

  return {
    libros,
    sedes,
    disponibilidad,
    cargando: cargandoLibros || cargandoInventario,
    error,
    reintentar,
    recargarDisponibilidad,
  };
}
