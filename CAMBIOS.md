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
| 12 | UDF `unaccent(TEXT)` en SQLite | `app.config.database` registra `unaccent` al conectar; los repos (`libro`, `autor`, `socio`) usan `func.unaccent(columna).ilike(unaccent_patron)` para búsquedas con tildes. `app.utils.texto.unaccent()` para construir el patrón desde Python. La DB seed Semillas no incluye autores todavía; el `test_listar_catalogo_texto_autor` cubre el caso con `García Márquez` que verifica que `"garc"` matchea |
| 13 | Exceptions module | `app/exceptions/{base,prestamo,reserva,catalogo,remito}.py` con reglas de negocio explícitas (ej. `SocioSancionado` se lanza sin importar tipo multa ni suspensión); no armarla throws ad-hoc. `BibliotecaError` engloba todo |
| 14 | Settings de conexión y seeds | `config/settings.py` ahora ancora `DATABASE_URL` relativa a `BACKEND_ROOT` para que no se pierda si el cwd cambia (o la app se levanta desde `tests/`); `app/seeds.py` con datos mínimos reales; `utils/security.py` PBKDF2; `.env.example` documentado al 100% |
| 15 | Service `prestamo_service` | Reglas duras: límite de préstamos activos, `SocioSancionado` sobre cualquier sanción, `EjemplarNoDisponible` si estado no es DISPONIBLE. `DIAS_PRESTAMO`/`MAX_PRESTAMOS_ABIERTOS` como constantes. Todas esas traps mapean a HTTP mediante `_mapear_excepcion` (409/403/400). |
| 16 | Controller `prestamo_controller` | `GET/POST /api/v1/prestamos`, `PUT /{id}/devolucion`, `GET /vencidos`, `GET /mios`. Sin auth; `?socio_id=` como query param para `/mios` hasta integrar `get_current_user` |
| 17 | Services `prestamo_service` + `reserva_service` + `remito_service` | Devolución de préstamo con: aplicación de sanción por 8 hs de día hábil ($5000×1.02^n, misma curva que el front), asignación de reserva FIFO en la sede de devolución o `EN_TRANSITO` si es otra sede, despacho de remito (setea `fecha_despacho` y pasa ejemplares a `EN_TRANSITO`), recepción actualiza `sede_actual` y asigna reservas. Un ejemplar en préstamo que viaja en remito se marca `EN_TRANSITO` al despachar. Al recibir, cada ejemplar en el remito llama `asignar_ejemplar_a_reserva_mas_vieja` (FIFO global), que busca la reserva más vieja **de toda la red** en estado `PENDIENTE` o `EN_TRANSITO` y la asigna a ese ejemplar si matchea sede |
| 18 | Tabla de tránsito | `remito_ejemplar` (N:M). Aislada del préstamo — un remito puede llevar varios ejemplares de distintos préstamos (ej. returning a una reserva interbibliotecaria) |
| 19 | Ciclo de remito | `CREADO → EN_TRANSITO → RECIBIDO` (o `CON_INCIDENCIA si se recibe dañado/faltante). Los ejemplares pasan a `EN_TRANSITO` en el despacho y a `DISPONIBLE`/`RESERVADO` al recibir |
| 20 | `/remitos` endpoints | `GET /api/v1/remitos/{id}`, `POST` (crea remito con `ejemplar_ids[]`), `PUT /api/v1/remitos/{id}/despacho` (CREADO→EN_TRANSITO), `PUT /api/v1/remitos/{id}/recepcion` (EN_TRANSITO→RECIBIDO/CON_INCIDENCIA + asignación de reservas; body opcional de incidencias EN_REPARACION/INUTILIZABLE). Detalle/listado incluyen `ejemplares[]` con info mínima (código, estado, libro, sede) para validar en mostrador |
| 21 | Auto-encolado a remito en devolución cross-sede | `asignar_ejemplar_a_reserva_mas_vieja` acepta `usuario_id`; si la reserva más vieja (FIFO global) es de otra sede, el ejemplar se encola en el remito CREADO de esa ruta (o se crea `R-YYYYMMDD-NNN` automáticamente) y queda RESERVADO; la reserva pasa a EN_TRANSITO. Al recibir, la reserva pasa a LISTA_PARA_RETIRO (2 días hábiles). `devolucion` y `recepcion` propagan `responsable_devolucion_id`/`responsable_recepcion_id`. Si un `recibir` informa incidencia sobre un ejemplar pre-asignado, su reserva vuelve a PENDIENTE sin ejemplar |
| 22 | Numeración de remito en `remito_service` | `generar_numero_remito(session, hoy)` vive en `remito_service` (antes en `reserva_service`) y la usa `crear_remito`: `RemitoCreate.numero_remito` es opcional y, si no viene, el service genera `R-YYYYMMDD-NNN` (falla controlada si se agotan los 999 del día). Corregido `date.timestamp()` inexistente (AttributeError) y eliminado el fallback roto |
| 23 | Endpoints tablero de remitos | `GET /api/v1/remitos/de-despacho`, `/de-recepcion`, `/con-incidencia` (filtrables por `?sede_id=`): devuelven `list[RemitoListadoDTO]` con `ejemplares_count` (selectinload, sin N+1) para el tablero de mostrador; el detalle con ejemplares queda en `GET /{id}` |
| 24 | `EjemplarEnRemitoDTO` mínimo | Los ejemplares embebidos en el detalle del remito exponen solo `id`, `codigo_inventario`, `descripcion_fisica` y `libro_nombre` (basta para validar en mostrador; el `id` es necesario para que el front informe incidencias al recibir). Se mantiene `id` en DTOs de recurso de primer nivel (decisión: es el estándar REST y el cliente lo necesita para direccionar rutas; la app es de intranet) |
| 25 | Encolado a remito en `remito_service` | La mecánica de encolar ejemplares (reusar el CREADO de la ruta o crear uno con `R-YYYYMMDD-NNN`) vive en `remito_service.encolar_ejemplar_en_ruta`; `reserva_service.asignar_ejemplar_a_reserva_mas_vieja` conserva solo la política (FIFO global, mismatch de sede). Antes estaba como `_encolumnar_en_remito` dentro de `reserva_service` |
| 26 | Service `crear_reserva` + ETA | `reserva_service.crear_reserva`: valida socio activo/sin sanción, libro y sede; con ejemplar local DISPONIBLE asigna (RESERVADO + LISTA_PARA_RETIRO, 48 hs hábiles); sin local pero con disponible en otra sede encola remito IDA (`responsable_creacion_id` por query) → reserva EN_TRANSITO; si no hay nada, PENDIENTE. `calcular_eta` (sin writes) estima la fecha mínima (DISPONIBLE local → hoy; otra sede → hoy+3 hábiles; PRESTADO → vencimiento **+ 2 días hábiles de retraso medio de devolución** (+ tránsito si está fuera)). Los candidatos se ordenan ascendente y **cada reserva PENDIENTE del libro en fila consume el candidato más cercano**: quien pregunta ve el (N+1)-ésimo (N = `contar_en_cola`); si no alcanzan, `eta = null`. `eta_para_reserva` expone esto sin crear la reserva (`GET /api/v1/reservas/eta`, para que el front muestre "Podés esperarlo para..." antes del alta). `POST /api/v1/reservas?responsable_creacion_id=` crea la reserva |
| 27 | `procesar_retiro` (retiro de reserva) | `reserva_service.procesar_retiro`: reserva `LISTA_PARA_RETIRO` dentro de las 48 hs hábiles → `CUMPLIDA` y nace el `Prestamo` (vía `prestamo_service.crear_prestamo_para_reserva`, que comparte `_validar_socio_y_limite` y `_nuevo_prestamo` con `crear_prestamo`; acepta el ejemplar RESERVADO a diferencia del alta normal). Valida sede de retiro exacta y ventana; 400 si no aplica, 409 si el socio está sancionado o sin cupo. `POST /api/v1/reservas/{id}/retira` devuelve el préstamo creado |
| 28 | `procesar_vencimientos` (batch) | `reserva_service.procesar_vencimientos`: para cada `LISTA_PARA_RETIRO` con ventana de retiro pasada (FIFO, `reserva_repository.listar_retiro_vencido`) marca la reserva `VENCIDA` y, si su ejemplar sigue `RESERVADO`, libera/reasigna al siguiente más viejo FIFO del libro (mismo sede → `LISTA_PARA_RETIRO`; otra sede → `EN_TRANSITO` + remito firmado por el `responsable_proceso_id`; sin cola → DISPONIBLE). Expuesta como `POST /api/v1/reservas/procesar-vencimientos?responsable_proceso_id=` |
| 29 | Cancelación de reserva | `reserva_service.cancelar_reserva`: sólo cancela reservas vivas (PENDIENTE/EN_TRANSITO/LISTA_PARA_RETIRO; CUMPLIDA/VENCIDA/CANCELADA → 400). Si el ejemplar pre-asignado sigue RESERVADO y **no viaja en un remito abierto**, libera y reasigna FIFO la siguiente del libro (vía `asignar_ejemplar_a_reserva_mas_vieja`). Si viajaba en remitos abiertos, la reserva se cancela igual y la recepción reasigna al llegar. `DELETE /api/v1/reservas/{id}?responsable_cancelacion_id=` devuelve la reserva cancelada |
| 30 | Listados de reservas | `reserva_service.listar_mios(socio_id)` → reservas del socio por fecha desc (cualquier estado), con libro/sede de retiro precargados; `listar_pendientes(libro_id?, sede_id?)` → cola `PENDIENTE` global en FIFO estricto (o cola del título / de la sede de retiro). `GET /api/v1/reservas/mios?socio_id=` y `GET /api/v1/reservas/pendientes?libro_id=&sede_id=` |
| 11.1 | `listar_catalogo_filtrado` | Método en `LibroRepository` con todos los filtros opcionales combinados AND: texto (título/ISBN), autor (JOIN), género, `sedes` (al menos un ejemplar DISPONIBLE en ellas, EXISTS), orden (`default`, `populares` con OUTER JOIN sobre préstamos para no perder los sin préstamos, o `recientes`) |
| 11.2 | Endpoint `GET /api/v1/libros/catalogo` con query params | `?titulo&isbn&autor&genero&sedes=1,2,3&orden=default\|populares\|recientes`. Cada uno AND al resto. `titulo`, `isbn` y `autor` son parciales; la unificación de la búsqueda previa quedó en `/catalogo` con `texto` eliminado (era ambigua semánticamente). `orden` desconocido → 400 |
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
