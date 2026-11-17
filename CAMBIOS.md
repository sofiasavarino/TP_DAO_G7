# Cambios con respecto a la presentación original (grupo 7)

Resumen de todo lo decidido/implementado con respecto a la presentación y a los primeros modelos.
Conviene para mantener actualizado el diagrama de clases y la doc.

## 0. Reestructuración del repositorio (monorepo back/front)

El proyecto pasó de un único paquete Python suelto a un **monorepo con `backend/` y `frontend/`**:

- `app/` → `backend/app/`; `tests/` → `backend/tests/`; `pyproject.toml` → `backend/pyproject.toml`.
  Instalación: `pip install -e "backend[.dev]"`.
- `.env` / `.env.example` → `backend/`. La key de Google Books vive solo en el backend (proxy de
  Google Books desde la API).
- `biblioteca.db` → `backend/` (`*.db` sigue en `.gitignore`).
- `frontend/` — SPA React + Vite + TypeScript (pendiente de negocio).
- **Stack reemplazada**: Flet fuera del diseño; backend HTTP con **FastAPI + Uvicorn** (REST/JSON);
  frontend React + Vite + TypeScript independiente. `flet` removida de `pyproject.toml`,
  `fastapi` y `uvicorn[standard]` agregadas.
- **Layout de capas**: `routers` (FastAPI, en `controllers/`) → `services` → `repositories` →
  `models`; `frontend` existe por fuera de Python. Los DTOs Pydantic ya son request/response de la API.
- La integración con Google Books pasa a ser **proxy backend** (la key nunca llega al frontend).

## 1. Cambios en modelos/código (estado implementado)

| # | Cambio | Detalle |
|---|---|---|
| 1 | `Prestamo` **sin remitos** | `remito_ida_id` y `remito_devolucion_id` eliminados (innecesarios con colección flotante). Un remito va asociado directamente a `Ejemplar` por `remito_ejemplar`, no al préstamo. La asociación paralela al prestamo se borra. |
| 2 | `Remito` → `Ejemplar` como punto de enlace | Tabla de unión `remito_ejemplar` (N:M) entre `Remito` y `Ejemplar`. Un remito puede llevar varios ejemplares; un ejemplar acumula su historial de remitos. Sin `remito_reserva`. |
| 3 | `Sancion` apunta a `Prestamo` | `sancion.prestamo_id` FK NOT NULL (una sanción nace de un préstamo). |
| 4 | `Libro` ↔ `Autor`: N a N | N:N implementado con `libro_autor` (PK compuesta, `secondary=`). En el diagrama de clases se dibuja la asociación N:N simple, sin tabla intermedia. |
| 5 | `Notificacion` nueva entidad | `notificacion (id, usuario_id FK, tipo, titulo, cuerpo, leida, fecha_creacion)`. `Tipo: RESERVA_LISTA`, también `RESERVA_VENCIDA` y `SANCION_APLICADA/LEVANTADA`, `EJEMPLAR_ASIGNADO`. Relación 1:N con `Usuario`. |
| 6 | `Reserva.sede_retiro_id` nuevo | FK a `Sede`. La reserva queda ligada a la sede de retiro (48 hs hábiles desde que el ejemplar queda `LISTA_PARA_RETIRO`). |
| 7 | `Reserva.fecha_expiracion` → `fecha_vencimiento_retiro` | Renombrada para reflejar semántica de "ventana de retiro"; equivalente lógica. |

## 2. Máquina de estados (inventario flotante)

`Inutilizable` es terminal, conserva histórico y es alcanzable desde cualquier estado (lo fuerza el service).

**Ejemplar:**

```
DISPONIBLE → RESERVADO → EN_TRANSITO → RESERVADO → PRESTADO → DISPONIBLE
                 ↓                                                    ↑
            EN_REPARACION ────────────────────────► Disponible        (devolución)
```

**Reserva:** `PENDIENTE → EN_CAMINO → LISTA_PARA_RETIRO → CUMPLIDA | VENCIDA | CANCELADA`

**Remito:** `CREADO → EN_TRANSITO → RECIBIDO` · (+ `CON_INCIDENCIA` si llega dañado, no pasa a estado alternativo, solo registra).

**Prestamo:** `ACTIVO → VENCIDO → FINALIZADO`

## 3. Estado de las otras zonas del sistema

- **Enum vs tabla**: no hay tabla `Estado` (decisión: `Rol` sigue como tabla; todos los estados son enums de Python en `app/models/enums.py`). Un patrón State se evalúa más adelante.
- **`Prestamo.estado`**: `ACTIVO / VENCIDO / FINALIZADO`. **`Prestamo.tipo`**: `LOCAL / INTERBIBLIOTECARIO` (se mantiene).
- **`Remito.estado`**: `CREADO / EN_TRANSITO / RECIBIDO / CON_INCIDENCIA`.
- **`Reserva.estado`**: `PENDIENTE / EN_CAMINO / LISTA_PARA_RETIRO / CUMPLIDA / VENCIDA / CANCELADA`.
- **`Socio.estado`**: `ACTIVO / SUSPENDIDO / BAJA`.
- **`Sancion.tipo`**: `MULTA` (usa `monto`) / `SUSPENSION` (usa `dias_suspension`).
- **`MotivoTraslado`** (antes `caracter_traslado: String`): enum `IDA / REBALANCEO`. Identifica remitos por préstamo saliente (`IDA`) de remitos administrativos (`REBALANCEO`, relocalización manual contable).
- **`NotificacionTipo`**: `RESERVA_LISTA / RESERVA_VENCIDA / SANCION_APLICADA / SANCION_LEVANTADA / EJEMPLAR_ASIGNADO`.
- **Límite de préstamos**: regla de service (p. ej. máx. N activos), no cardinalidad del modelo.
- **Prioridad de asignación**: FIFO estricto (gana la reserva creada primero para el mismo título).
- **Partido de capas** (documentado en el README): repos precargan con `selectinload`/`func`; navegación a-uno por lazy load en el service; DTOs se arman dentro de la sesión.
- **Frontend React + Vite + TypeScript**: consume API FastAPI con JWT simple (access token); la API key de libros vive en backend (proxy Google Books); CORS habilitado para origen de desarrollo con IP privada.
- **Pendiente seeds**: `backend/seeds.py` con 3 sedes (ej. Centro, Norte, Sur) y 1 usuario por rol — `socio1`, `bibliotecario1`, `admin1` (rol = Socio/Bibliotecario/Administrador, password de prueba). Obligatorio para el primer arranque después del próximo reset de la DB.
