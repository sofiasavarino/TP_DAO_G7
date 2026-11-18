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
| `notifications` | Envío de notificaciones (Observer o Strategy). Opcional, se agrega al final. |
| `integrations/googlebooks` | Cliente HTTP de Google Books y mapper de la respuesta a `Libro` y `Autor`. Solo lo usa el service de libro. |
| `exceptions` | Excepciones de dominio (`LimitePrestamosExcedido`, `SocioSancionado`, etc.). |
| `utils` | Funciones auxiliares (fechas, etc.). |
| `tests` | Tests de services y repositories. |

## Endpoints disponibles (FastAPI + Uvicorn)

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/health` | Health check (fuera del namespace API, para smoke tests del proxy/infra) |
| GET | `/api/v1/libros/lookup?isbn=...` | Autocompletado por ISBN: local → Google Books → `MANUAL` (la vista pide carga manual) |
| GET | `/api/v1/catalogo` | Catálogo de libros (con autores precargados) |
| GET | `/api/v1/catalogo/{id}` | Detalle de un libro |
| GET | `/api/v1/libros/buscar?texto=…` · `/titulo` · `/autor` | Búsqueda libre por título/ISBN/autor |
| POST | `/api/v1/libros` | Alta de libro; dedupa por ISBN (devuelve el existente) |
| GET | `/api/v1/ejemplares/disponibles?libro_id=&sede_id=` | Consulta de disponibilidad filtrada por sede actual |
| GET | `/api/v1/ejemplares/por-libro/{id}` | Todos los ejemplares de un libro |
| POST | `/api/v1/ejemplares` | Alta de ejemplar físico (código único) |
| PATCH | `/api/v1/ejemplares/{id}/estado` | Cambio de estado de un ejemplar |

- `/docs` — Swagger UI generado por FastAPI. `/openapi.json` — spec OpenAPI.
- Versionado: todas las rutas de negocio cuelgan de `/api/v1/<recurso>` (`/api/v1/libros`, `/api/v1/prestamos`, ...). Cambios incompatibles a `v2` en el futuro.
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

**SQLite.** Las claves foráneas vienen apagadas por defecto. Se activan en `config` con `PRAGMA foreign_keys=ON`.

## Instalación

Backend:

```bash
cd backend
python -m venv ../.venv     # o el venv que prefieran, p. ej. backend/.venv
source ../.venv/bin/activate   # En Windows: ..\.venv\Scripts\activate
pip install -e ".[dev]"        # instala las dependencias de backend/pyproject.toml
cp .env.example .env           # Completar la API key de Google Books
python -m app.seeds            # datos iniciales: 3 sedes, 3 roles, usuarios seed, catálogo de muestra
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
