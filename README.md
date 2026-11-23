# Sistema de Gestión de Biblioteca

TP integrador de Desarrollo de Aplicaciones con Objetos, FRC UTN. Grupo 7.

Gestiona el catálogo, los socios y la logística de una red de bibliotecas: préstamos locales e interbibliotecarios, reservas, sanciones y remitos.

## Stack

| Componente | Tecnología |
|---|---|
| Lenguajes | Python 3.12+ (backend) · TypeScript (frontend) |
| Base de datos | SQLite |
| ORM | SQLAlchemy 2.0 (`Mapped[]` y `mapped_column`) |
| DTOs y validación | Pydantic |
| Backend HTTP | FastAPI + Uvicorn (REST/JSON, OpenAPI incluido) |
| Frontend | React + Vite + TypeScript |
| Integración externa | Google Books API (proxy desde el backend: la API key vive en el servidor) |
| Arquitectura | Monolito en capas (backend) + SPA React (frontend) |

## Estructura del proyecto

```
TP_DAO_G7/
├── backend/
│   ├── app/
│   │   ├── config/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── controllers/
│   │   ├── dtos/
│   │   ├── states/
│   │   ├── reports/
│   │   ├── notifications/
│   │   ├── integrations/
│   │   │   └── googlebooks/
│   │   ├── exceptions/
│   │   ├── utils/
│   │   └── main.py          # pendiente: FastAPI entrypoint (uvicorn app.main:app)
│   ├── tests/
│   │   ├── services/
│   │   └── repositories/
│   ├── .env
│   ├── .env.example
│   ├── pyproject.toml
│   └── biblioteca.db        # SQLite local (no se commitea)
├── frontend/                # SPA React + Vite + TypeScript (pendiente de creación)
├── .gitignore
├── README.md
└── CAMBIOS.md
```

| Carpeta | Contenido |
|---|---|
| `config` | Settings (variables de entorno, API key de Google) y configuración de la base: engine, `SessionLocal`, `PRAGMA foreign_keys=ON`. |
| `models` | Entidades SQLAlchemy, la clase base con baja lógica (`activo`) y los enums. |
| `repositories` | Acceso a datos. Un repository por entidad, sobre un repository base con CRUD genérico. |
| `services` | Reglas de negocio y manejo de transacciones. |
| `controllers` | Routers de FastAPI: reciben el request HTTP, arman DTOs de entrada, llaman al service y devuelven el DTO de respuesta. |
| `dtos` | Objetos de transferencia con Pydantic. Son también el modelo request/response de la API (FastAPI los valida igual automáticamente). |
| `states` | Pensado para el patrón State. Se agrega al final, solo si se termina implementando. |
| `reports` | Reportes y estadísticas. Opcional, se agrega al final. |
| `notifications` | Envío de notificaciones con patrón **Observer**: `EventManager` (suscripción por tipo de evento), `EventListener`/`PersistirListener`/`MailListener`, `NotificacionService` (publisher concreto) y `mensajes.py` (qué se dice y a quién). El mail se envía después del commit vía `despues_del_commit`. |
| `integrations/googlebooks` | Cliente HTTP de Google Books y mapper de la respuesta a `Libro` y `Autor`. Solo lo usa el service de libro. |
| `exceptions` | Excepciones de dominio (`LimitePrestamosExcedido`, `SocioSancionado`, etc.). |
| `utils` | Funciones auxiliares (fechas, `despues_del_commit` para correr acciones recién después del commit, etc.). |
| `tests` | Tests de services y repositories. |

## Endpoints disponibles (FastAPI + Uvicorn)

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/health` | Health check (fuera del namespace API, para smoke tests del proxy/infra) |
| GET | `/api/v1/libros/lookup?isbn=...` | Autocompletado por ISBN: local → Google Books → `MANUAL` (la vista pide carga manual) |
| GET | `/api/v1/libros/catalogo` · `?titulo=&isbn=&autor=&genero=&sedes=1,2,3&orden=default\|populares\|recientes` | Catálogo filtrable: AND entre todos los parámetros. `titulo` (título parcial), `isbn` (ISBN parcial), `autor` (nombre parcial), género (exacto), disponibilidad por sede, orden por popularidad o fecha de publicación. Sin parámetros devuelve todo ordenado por nombre. |
| GET | `/api/v1/libros/catalogo/{id}` | Detalle de un libro |
| POST | `/api/v1/libros` | Alta de libro; dedupa por ISBN (devuelve el existente y lo reactiva si estaba de baja). Acepta `autores` por nombre: reutiliza los existentes y crea los que falten |
| GET | `/api/v1/libros/google?q=&max_resultados=` | Proxy a Google Books por título, autor o ISBN (lista de resultados para el formulario de alta). Bibliotecario/Admin. 503 si falta la API key o Google no responde |
| PUT | `/api/v1/libros/{id}` | Edición de un libro (reemplaza datos y autores). 409 si el ISBN ya lo tiene otro libro. Bibliotecario/Admin |
| PATCH | `/api/v1/libros/{id}/baja` | Baja lógica (`activo = false`): deja de aparecer en `/catalogo`. 409 si tiene ejemplares prestados, reservados o en tránsito. Bibliotecario/Admin |
| GET | `/api/v1/prestamos` | Listado general de préstamos |
| POST | `/api/v1/prestamos` | Alta de préstamo (`DIAS_PRESTAMO=15` calculado por backend; `LimitePrestamosExcedido`, `SocioSancionado`, `EjemplarNoDisponible`)
| POST | `/api/v1/reservas?responsable_creacion_id=` | Alta de reserva: asigna ejemplar DISPONIBLE local (`LISTA_PARA_RETIRO`); si sólo hay en otra sede encola remito IDA (`EN_TRANSITO`); si no hay nada, `PENDIENTE`. Body: `socio_id, libro_id, sede_retiro_id` |
| POST | `/api/v1/reservas/procesar-vencimientos?responsable_proceso_id=` | Cierra `LISTA_PARA_RETIRO` vencidas (FIFO): reserva → `VENCIDA`; ejemplar RESERVADO se libera y se sirve la siguiente reserva más vieja FIFO del libro (o queda DISPONIBLE). Devuelve la lista de vencidas |
| GET | `/api/v1/reservas/mios?socio_id=` | Reservas del socio, de la más reciente a la más vieja (cualquier estado) |
| GET | `/api/v1/reservas/pendientes?libro_id=&sede_id=` | Cola de espera SIN ejemplar (`PENDIENTE`) de toda la red, FIFO. Filtros combinan con AND (`?libro_id=1&sede_id=2` = pendientes del libro 1 para retirar en sede 2) |
| DELETE | `/api/v1/reservas/{id}?responsable_cancelacion_id=` | Cancelación de reserva viva (`PENDIENTE`/`EN_TRANSITO`/`LISTA_PARA_RETIRO`) → `CANCELADA`. Si el ejemplar pre-asignado no viaja en un remito, se libera y se sirve la siguiente reserva FIFO; si viaja, se reasigna al llegar al destino. `CUMPLIDA`/`VENCIDA`/`CANCELADA` → 400 |
| POST | `/api/v1/reservas/{id}/retira?sede_id=&responsable_retiro_id=&tipo=LOCAL` | El socio retira la reserva `LISTA_PARA_RETIRO` (dentro de las 48hs hábiles): reserva → `CUMPLIDA` y nace el préstamo real (`P-NNNNNN`, `DIAS_PRESTAMO=15`); falla si no está en LISTA_PARA_RETIRO, la ventana venció, la sede no es la de retiro, o el socio está sancionado/sin cupo |
| GET | `/api/v1/reservas/eta?libro_id=&sede_retiro_id=` | Vista previa SIN crear la reserva: `disponible_ahora` y `eta` (fecha mínima estimada o null). Para que el front muestre "Podés esperarlo para…" antes de reservar | |
| POST | `/api/v1/sanciones?responsable_id=` | Alta de sanción manual sobre un préstamo (`MULTA` con `monto` o `SUSPENSION` con `dias_suspension`); valida socio activo y que el préstamo no tenga ya sanción |
| GET | `/api/v1/sanciones?socio_id=` | Sanciones vigentes hoy (filtrables por socio) |
| GET | `/api/v1/sanciones/{socio_id}` | Sanciones vigentes de un socio |
| PUT | `/api/v1/sanciones/{id}/levantar?responsable_id=` | Levanta la sanción (marca inactiva + `fecha_fin=hoy`); el socio vuelve a poder reservar/prestar |
| GET | `/api/v1/prestamos/mios?socio_id=` | Préstamos del socio con libro (`libro_nombre`, `libro_imagen_url`…) y fechas de inicio/vencimiento/devolución (sin auth todavía, `?socio_id=` hasta implementar `get_current_user`) |
| GET | `/api/v1/notificaciones/mios?usuario_id=&solo_no_leidas=` | Notificaciones del usuario (no del socio), de la más nueva a la más vieja |
| GET | `/api/v1/notificaciones/mios/no-leidas/cantidad?usuario_id=` | `{cantidad}` para el globito de la campanita |
| PUT | `/api/v1/notificaciones/{id}/leida?usuario_id=` | Marca una como leída (idempotente) |
| PUT | `/api/v1/notificaciones/mios/leidas?usuario_id=` | Marca todas como leídas; devuelve `{marcadas}` |
| GET | `/api/v1/prestamos/vencidos` | Préstamos en estado VENCIDO |
| PUT | `/api/v1/prestamos/{id}/devolucion?sede_id=&responsable_devolucion_id=` | Cierra préstamo; aplica sanción por retraso si la hay; si hay reserva más vieja de ese libro en otra sede, encola el ejemplar en un remito `CREADO` (o lo crea) rumbo a esa sede y la reserva queda `EN_TRANSITO`; si la reserva es en la misma sede, la asigna (`LISTA_PARA_RETIRO`) |
| PUT | `/api/v1/prestamos/{id}/renovacion` | Extiende `fecha_vencimiento` 15 días; bloqueado si está vencido o hay reserva esperando ese libro |
| POST | `/api/v1/remitos` | Crea un remito con ejemplares (`responsable_creacion_id` en query); queda `CREADO`. `numero_remito` opcional: si no viene, el backend lo autogenera `R-YYYYMMDD-NNN` |
| GET | `/api/v1/remitos/de-despacho?sede_id=` | Tablero: remitos `CREADO` (filtrable por sede de origen) con `ejemplares_count` |
| GET | `/api/v1/remitos/de-recepcion?sede_id=` | Tablero: remitos `EN_TRANSITO` (filtrable por sede de destino) con `ejemplares_count` |
| GET | `/api/v1/remitos/con-incidencia?sede_id=` | Tablero: remitos `CON_INCIDENCIA` (filtrable por sede de destino) con `ejemplares_count` |
| GET | `/api/v1/remitos/{id}` | Detalle del remito (incluye `ejemplares[]` con info para validar en mostrador) |
| PUT | `/api/v1/remitos/{id}/despacho?responsable_despacho_id=` | Despacho: pasa a `EN_TRANSITO`, `fecha_despacho=hoy`, ejemplares a `EN_TRANSITO` |
| PUT | `/api/v1/remitos/{id}/recepcion?responsable_recepcion_id=&observaciones=` · body opcional `[{"ejemplar_id":n,"estado":"EN_REPARACION"\|"INUTILIZABLE"}]` | Recepción: pasa a `RECIBIDO` (o `CON_INCIDENCIA` si hay body de incidencias), actualiza `sede_actual` de cada ejemplar, asigna reservas si corresponde (reserva pre-asignada a un ejemplar dañado vuelve a `PENDIENTE`) |
| GET | `/api/v1/ejemplares/disponibles?libro_id=&sede_id=` | Consulta de disponibilidad filtrada por sede actual |
| GET | `/api/v1/ejemplares/por-libro/{id}` | Todos los ejemplares de un libro |
| POST | `/api/v1/ejemplares` | Alta de ejemplar físico (código único) |
| GET | `/api/v1/ejemplares?libro_id=&sede_id=&estado=` | Inventario físico (todos los estados) con libro y sedes resueltos; filtros AND por libro, sede actual y estado. Bibliotecario/Admin |
| POST | `/api/v1/ejemplares/lote` | Alta rápida de 1..50 copias de un libro en una sede (origen = actual). Códigos `I-<sede>-<libro>`, `-2`, `-3`… o uno manual si es 1 copia. El Bibliotecario solo en su sede (403); el Administrador en cualquiera |
| PATCH | `/api/v1/ejemplares/{id}/reparacion` | `DISPONIBLE` → `EN_REPARACION`. 409 si el estado no lo admite; 403 si un Bibliotecario lo intenta sobre un ejemplar de otra sede |
| PATCH | `/api/v1/ejemplares/{id}/reincorporacion` | `EN_REPARACION` → `DISPONIBLE`. 409 si el estado no lo admite; 403 si un Bibliotecario lo intenta sobre un ejemplar de otra sede |
| PATCH | `/api/v1/ejemplares/{id}/inutilizable` | `DISPONIBLE`/`EN_REPARACION` → `INUTILIZABLE` (terminal). 409 si el estado no lo admite; 403 si un Bibliotecario lo intenta sobre un ejemplar de otra sede |
| GET | `/api/v1/sedes` | Sedes activas (para selectores). Requiere sesión |
| PATCH | `/api/v1/ejemplares/{id}/estado` | Cambio de estado de un ejemplar |

- `/docs` — Swagger UI generado por FastAPI. `/openapi.json` — spec OpenAPI.
- Versionado: todas las rutas de negocio cuelgan de `/api/v1/<recurso>` (`/api/v1/libros`, `/api/v1/prestamos`, ...). Cambios incompatibles a `v2` en el futuro.
- **Seed de catálogo masivo (una sola corrida, opcional)**: con `GOOGLE_BOOKS_API_KEY` en `backend/.env`, después de `python -m app.seeds`, ejecutar `python -m app.seed_catalogo_google`. Consulta Google Books por título/autor (108 títulos), crea libros (dedup por ISBN o nombre) + autores, y 3 ejemplares por libro (1 por sede). Idempotente.
- CORS: abierto a `localhost:5173`/`5174` para el frontend; ajustar `allow_origins` en `app/main.py` al deployear.

## Arquitectura

Cada capa solo conoce a la que tiene debajo. El frontend consume la API HTTP/JSON:

```
frontend (React)
      ⇄ HTTP/JSON
routers (FastAPI, en controllers/) → services → repositories → models
```

| Capa | Responsabilidad | No debe |
|---|---|---|
| `frontend` | SPA en React: render y captura de eventos | Conocer detalles de la DB ni reglas de negocio |
| `routers` (FastAPI) | Recibir request HTTP, armar DTOs de entrada, llamar al service, devolver DTO de salida | Contener reglas de negocio ni tocar la base |
| `services` | Reglas de negocio y manejo de la transacción | Exponer DTOs crudos de infra o conocer Flet/HTTP |
| `repositories` | Queries sobre la sesión recibida: colecciones (listados, historiales) y agregados (`count`, `sum`) con `selectinload`/`func` | Hacer `commit()` ni tener reglas de negocio |
| `models` | Mapeo de tablas y relaciones | Contener lógica de negocio |

**Navegación del ORM.** Los services pueden navegar relaciones a-uno por lazy loading (`prestamo.ejemplar`, `ejemplar.libro`): son lookups por PK, baratos y quedan dentro de la transacción abierta. Lo que involucra colecciones o agregados lo resuelve siempre el repository: listados con `selectinload` (evita el N+1), conteos para reglas de negocio con `func.count` (p. ej. el límite de préstamos activos de un socio). Si un caso de uso encadena 3 o más lazy loads, se precarga el grafo desde el repository. Los DTOs se arman dentro de la sesión (`PrestamoDTO.model_validate(prestamo)` o `PrestamoListadoDTO.from_model(...)` para enriquecidos); nunca se devuelven objetos ORM vivos al controller ni a la vista.

## Convenciones

**Nombres en el código (`.py`).** Se sigue PEP 8:

- Clases en PascalCase: `PrestamoService`, `Socio`.
- Archivos, atributos, métodos y variables en `snake_case`: `prestamo_service.py`, `fecha_inicio`, `asignar_ejemplar()`, `reserva_repo`.
- Carpetas en minúscula.
- Sin tildes ni eñes en identificadores (`Resena`, `direccion`, `fecha_recepcion`).

**Nombres en la base de datos.** También `snake_case` para tablas y columnas (`prestamo`, `fecha_inicio`, `remito_ida_id`). Como el atributo y la columna se llaman igual, no hace falta indicar el nombre de la columna en el modelo:

```python
class Prestamo(Base):
    __tablename__ = "prestamo"

    fecha_inicio: Mapped[date]
    remito_ida_id: Mapped[int | None] = mapped_column(ForeignKey("remito.id"))
```

**Baja lógica.** Nunca se borra físicamente. Se marca `activo = False` y los repositories filtran por activos por defecto.

**Enums.** Los valores fijos van como `Enum` de Python en el módulo de enums de `models`. No hay tabla `Estado`: todos los estados (socio, préstamo, ejemplar, reserva, remito) son enums. Más adelante se puede evaluar el patrón State (ver `states` en la estructura del proyecto). La tabla `Rol` sí existe y se usa en `Usuario`, donde el diagrama lo indica.

**Transacciones.** El service abre la transacción y los repositories reciben la sesión:

```python
with SessionLocal.begin() as session:   # commit al salir, rollback ante excepción
    reserva = self.reserva_repo.get(session, reserva_id)
    self.prestamo_repo.crear(session, ...)
```

Si un service necesita llamar a otro, le pasa la misma sesión. Si cada uno abre la suya, se pierde la atomicidad.

**Excepciones.** Las reglas de negocio lanzan excepciones de `exceptions`. El controller las captura y la vista muestra el mensaje.

**SQLite y tildes.** El motor `SQLite` no es accent-insensitive: `ilike "%cortazar%"` no matchea `"Cortázar"`. Para evitarlo se registra una UDF `unaccent(TEXT)` al momento de iniciar la conexión vía `app.config.database`; conviene usar `func.unaccent(<columna>).ilike(...)` en las búsquedas de texto. La UDF es un `NFKD + filter mn + lower`, no Postgres-grade. La mejor vía es funciones similares basadas en collation en el futuro; mientras tanto, esto evita bugs por errores tipográficos en los usuarios.

## Instalación

Backend:

```bash
cd backend
python -m venv ../.venv     # o el venv que prefieran, p. ej. backend/.venv
source ../.venv/bin/activate   # En Windows: ..\.venv\Scripts\activate
pip install -e ".[dev]"        # instala las dependencias de backend/pyproject.toml
cp .env.example .env           # Completar la API key de Google Books (se necesita para el paso siguiente)
python -m app.seeds            # datos iniciales: 3 sedes, 3 roles, usuarios seed, catálogo de muestra
python -m app.seed_catalogo_google  # OPCIONAL: importa ~108 libros desde Google Books (3 ejemplares por libro, 1 por sede); requiere GOOGLE_BOOKS_API_KEY en backend/.env
uvicorn app.main:app --reload  # http://localhost:8000 | documentación en /docs
```

Frontend:

```bash
cd frontend                 # cuando se cree la SPA
npm install
npm run dev
```

## Integrantes

| Legajo | Nombre |
|---|---|
| 403313 | Toselli Gabriel |
| 403272 | Oliva Mateo |
| 90758 | Internicola Macarena |
| 401547 | Savarino Sofía |
| 88655 | Medina Sofía |
