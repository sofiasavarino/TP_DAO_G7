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
| 8 | `libro.imagen_url` nueva | Columna `String(500)` NULL con el link a la portada; se llena igualmente en el alta por Google Books (autocompletable con ISBN). No estaba en el diagrama original. |
| 9 | Namespace `/api/v1/<recurso>` | Todas las rutas de negocio pasan por env `API_PREFIX = "/api/v1"` en `app/main.py` (ver README). Health check en `/health` fuera del namespace, reservado para infra. |
| 9.1 | Tabla `libro` | CRUD completo demostrado como patrón para copiar al resto: servicios Pydantic, resymbol layer, endpoints `Catálogo`/`Libro` + `buscar`, y Pydantic E2E. |
| 9.1.2 | Migrado config/settings.py | `config/settings.py` ahora lee `.env` para todas las credenciales (DB, Google, JWT, SMTP). `DATABASE_URL` ya no es un string hardcodeado. `config/database.py` ahora depende de settings. `app/utils/security.py` con `hash_password`/`verify_password` (PBKDF2-SHA256). Seeds v1 (`app/seeds.py`): idempotentes, crea 3 sedes, 3 roles, 3 usuarios con passwords hasheados (`socio1/socio123`, `bibliotecario1/biblio123`, `admin1/admin123`), vinculación usuario→perfil (Socio/Empleado) y 3 libros con 9 ejemplares × libro × sede. |
| 9.2 | Service de libro | `crear_libro(datos)` con dedup por ISBN y resolución de autores; `buscar/listar/to_listado_dto`. Cuando el ISBN existe se devuelve el existente sin duplicar. |
| 9.3 | Reportes `mas_solicitados` y `disponibilidad_por_sede` | Atributos relevantes para el módulo de reportes del TP (ver reportes) |
| 9.4 | Tests mínimos de pytest | `conftest.py` con `:memory:` + `TestClient` + dependency-override; 10 tests verdes (libro service + repo) |
| 10 | Columna `genero` en `libro` | `String(50)` NULL; `LibroCreate`, `LibroDTO`, `LibroListadoDTO` y `LibroLookupDTO` la exponen; el mapper de Google Books llena `genero` desde `categories[0]`. Seeds con género precargado (se aplicó `UPDATE` al local dev) |
| 11.1 | `listar_catalogo_filtrado` | Método en `LibroRepository` con todos los filtros opcionales combinados AND: texto (título/ISBN), autor (JOIN), género, `sedes` (al menos un ejemplar DISPONIBLE en ellas, EXISTS), orden (`default`, `populares` con OUTER JOIN sobre préstamos para no perder los sin préstamos, o `recientes`) |
| 11.2 | Endpoint `GET /api/v1/catalogo` con query params | `?texto&autor&genero&sedes=1,2,3&orden=default\|populares\|recientes` con validación (`orden` desconocido → 400) |
| 9.1.1 | Integración Google Books + ruta de lookup | `integrations/googlebooks/client.py` + `mapper.py`; service `libro_service.buscar_libro_por_isbn` (local → Google → manual); expuesta por `GET /api/v1/libros/lookup?isbn=…`. La API key vive en `backend/.env` (`GOOGLE_BOOKS_API_KEY`), nunca en el frontend. `app/main.py` con app FastAPI + CORS para localhost:5173/5174. |

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
