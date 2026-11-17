# Cambios con respecto a la presentación original (grupo 7)

Resumen de todo lo decidido/implementado con respecto a la presentación y a los primeros modelos.
Conviene para mantener actualizado el diagrama de clases y la doc.

## 0. Reestructuración del repositorio (monorepo back/front)

El proyecto pasa de un único paquete Python suelto a un **monorepo con `backend/` y `frontend/`**:

- `app/` → `backend/app/` (los modelos, services, repositories, DTOs, etc. viven bajo `backend/`).
- `tests/` → `backend/tests/`.
- `pyproject.toml` → `backend/pyproject.toml`. Instalación: `pip install -e "backend[.dev]"`.
- `.env` / `.env.example` → `backend/`. La key de Google Books vive solo en el backend (proxy de Google Books desde la API).
- `biblioteca.db` → `backend/` (sigue `*.db` en `.gitignore`).
- `frontend/` — nueva carpeta vacía; la SPA React + Vite + TypeScript se crea ahí próximamente.
- **Stack reemplazada**: Flet salió del diseño; backend HTTP con **FastAPI + Uvicorn** (REST/JSON); frontend React + Vite + TypeScript independiente consumiendo la API. `flet` removida de `pyproject.toml`; quedó documentado Flet como descartado.
- **Layout de capas**: `routers` (FastAPI, en `controllers/`) → `services` → `repositories` → `models`; `frontend` por fuera de Python. Los DTOs Pydantic ya son la forma de request/response de la API — sin capa anti-corrupción extra.
- La integración externa con Google Books pasa a llamarse **proxy backend** (la key nunca llega al frontend).

## 1. Modelos / código (implementado)

| # | Cambio | Detalle |
|---|---|---|
| 1 | `Prestamo.sede_origen_id` / `sede_destino_id` NO existen (decisión) | El traslado interbibliotecario lo modela `Remito` (`sede_origen_id`/`sede_destino_id`). El préstamo solo referencia el remito de ida y de vuelta. |
| 2 | `Prestamo` ↔ `Remito`: dos FKs opcionales | `remito_ida_id` y `remito_devolucion_id` (solo interbibliotecarios). Un remito transporta muchos préstamos; un préstamo tiene como máximo un remito de ida y uno de vuelta. No hace falta tabla intermedia. En el modelo (y en el diagrama de clases) se refleja con dos relationships espejo: `Prestamo.remito_ida`/`remito_devolucion` ↔ `Remito.prestamos_ida`/`prestamos_devolucion`, una por cada FK. |
| 3 | `Sancion` siempre apunta a `Prestamo` | `sancion.prestamo_id` FK NOT NULL (una sanción nace de un préstamo). |
| 4 | `Libro` ↔ `Autor`: N a N | N:N implementado con tabla intermedia `libro_autor` (PK compuesta, `secondary=`). En el diagrama de clases se dibuja la asociación N:N simple, sin tabla intermedia. |

## 2. Máquina de estados del ejemplar (implementada en `EstadoEjemplar`)

Estado anterior → actual:

| Antes | Ahora |
|---|---|
| `DISPONIBLE` | `DISPONIBLE` |
| `PRESTADO` | `PRESTADO` (un solo estado; ya no hay "prestado intersede" separado) |
| `EN_TRANSITO` | `EN_TRANSITO_IDA` **y** `EN_TRANSITO_VUELTA` |
| `DANADO` | **Eliminado** → `EN_REPARACION` |
| `BAJA` | **Renombrado** a `INUTILIZABLE` |
| — | **Nuevo**: `RESERVADO` |
| — | **Nuevo**: `EN_OTRA_SEDE` |

Flujo: `Disponible → Prestado → Disponible` (local). Interbibliotecario:
`Disponible → [Reservado] → EnTransitoIda → EnOtraSede → Prestado → Devuelto → EnTransitoVuelta → Disponible`.
`Inutilizable` es terminal, se conserva históricamente (nunca se borra la fila), y **es alcanzable
desde cualquier estado** (pérdida/destrucción/robo/inundación; lo fuerza el service).
El diagrama de estados vive en `ejemplar-estados.mmd` (Mermaid).

Decisión de diseño: la dirección del tránsito la indica el propio estado del ejemplar
(`EN_TRANSITO_IDA` = viajando de su sede hacia otra; `EN_TRANSITO_VUELTA` = retorno a su sede),
sin atributo de dirección. El `remito` abierto asociado (ida o devolución) lleva los datos del traslado.

## 3. Estado de las otras zonas del sistema

- **Enum vs tabla**: no hay tabla `Estado` (decisión: `Rol` sigue como tabla; todos los estados
  son enums de Python en `app/models/enums.py`). Un patrón State podría implementarse más
  adelante (ver `states` en la estructura del proyecto).
- **`Prestamo.estado`**: se mantiene (`ACTIVO / VENCIDO / DEVUELTO`).
- **`Remito.estado`**: `CREADO / DESPACHADO / RECIBIDO`.
- **`Remito.caracter_traslado`**: enum `TipoTraslado` (`IDA` / `VUELTA`). Indica si el remito es de ida o de vuelta (solo interbibliotecarios). Lo valida el service al crear el remito según el rol: `VUELTA` ↔ existe `prestamo.remito_devolucion_id = remito.id`; `IDA` ↔ existe `prestamo.remito_ida_id = remito.id`. La dirección del viaje también está reflejada en el estado del ejemplar (`EN_TRANSITO_IDA/VUELTA`); `caracter_traslado` existe para que el mostrador de la logística pueda listar remitos por tipo de traslado con un simple `WHERE`.
- **`Reserva.estado`**: `PENDIENTE / ASIGNADA / EXPIRADA / CANCELADA`.
- **`Socio.estado`**: `ACTIVO / SUSPENDIDO / BAJA`.
- **`Sancion.tipo`**: `MULTA` (usa `monto`) / `SUSPENSION` (usa `dias_suspension`).
- **`Prestamo.tipo`**: `LOCAL` / `INTERBIBLIOTECARIO`.
- **Límite de préstamos**: no es cardinalidad del modelo; es **regla de service** (p. ej. máx. N
  activos). Multiplicidad socio→prestamo: `0..*`.
- **Partido de capas** (documentado en el README): repos precargan con `selectinload`/`func`;
  navegación a-uno por lazy load en el service; DTOs se arman dentro de la sesión.
