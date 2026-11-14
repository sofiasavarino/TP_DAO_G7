# Sistema de Gestión de Biblioteca

TP integrador de Desarrollo de Aplicaciones con Objetos, FRC UTN. Grupo 7.

Gestiona el catálogo, los socios y la logística de una red de bibliotecas: préstamos locales e interbibliotecarios, reservas, sanciones y remitos.

## Stack

| Componente | Tecnología |
|---|---|
| Lenguaje | Python 3.12+ |
| Base de datos | SQLite |
| ORM | SQLAlchemy 2.0 (`Mapped[]` y `mapped_column`) |
| DTOs y validación | Pydantic |
| Interfaz | Flet (versión fijada en `pyproject.toml`) |
| Integración externa | Google Books API |
| Arquitectura | Monolito en capas |

## Estructura del proyecto

```
TP_DAO_G7/
├── app/
│   ├── config/
│   ├── models/
│   ├── repositories/
│   ├── services/
│   ├── controllers/
│   ├── dtos/
│   ├── views/
│   │   └── components/
│   ├── states/
│   ├── reports/
│   ├── notifications/
│   ├── integrations/
│   │   └── googlebooks/
│   ├── exceptions/
│   └── utils/
├── tests/
│   ├── services/
│   └── repositories/
├── .env
├── .gitignore
├── pyproject.toml
└── README.md
```

| Carpeta | Contenido |
|---|---|
| `config` | Settings (variables de entorno, API key de Google) y configuración de la base: engine, `SessionLocal`, `PRAGMA foreign_keys=ON`. |
| `models` | Entidades SQLAlchemy, la clase base con baja lógica (`activo`) y los enums. |
| `repositories` | Acceso a datos. Un repository por entidad, sobre un repository base con CRUD genérico. |
| `services` | Reglas de negocio y manejo de transacciones. |
| `controllers` | Puente entre las vistas y los services. |
| `dtos` | Objetos de transferencia con Pydantic. |
| `views` | Pantallas de Flet. `components` tiene los widgets reutilizables. |
| `states` | Pensado para el patrón State. Se agrega al final, solo si se termina implementando. |
| `reports` | Reportes y estadísticas. Opcional, se agrega al final. |
| `notifications` | Envío de notificaciones (Observer o Strategy). Opcional, se agrega al final. |
| `integrations/googlebooks` | Cliente HTTP de Google Books y mapper de la respuesta a `Libro` y `Autor`. Solo lo usa el service de libro. |
| `exceptions` | Excepciones de dominio (`LimitePrestamosExcedido`, `SocioSancionado`, etc.). |
| `utils` | Funciones auxiliares (fechas, etc.). |
| `tests` | Tests de services y repositories. |

El punto de entrada es `app/main.py`, que inicia la aplicación Flet.

## Arquitectura

Cada capa solo conoce a la que tiene debajo:

```
views → controllers → services → repositories → models
```

| Capa | Responsabilidad | No debe |
|---|---|---|
| `views` | Dibujar pantallas y capturar eventos | Llamar a services o repositories directamente |
| `controllers` | Recibir eventos de la vista, armar DTOs, llamar al service | Contener reglas de negocio ni tocar la base |
| `services` | Reglas de negocio y manejo de la transacción | Conocer Flet |
| `repositories` | Queries sobre la sesión recibida: colecciones (listados, historiales) y agregados (`count`, `sum`) con `selectinload`/`func` | Hacer `commit()` ni tener reglas de negocio |
| `models` | Mapeo de tablas y relaciones | Contener lógica de negocio |

**Navegación del ORM.** Los services pueden navegar relaciones a-uno por lazy loading (`prestamo.ejemplar`, `ejemplar.libro`): son lookups por PK, baratos y quedan dentro de la transacción abierta. Lo que involucra colecciones o agregados lo resuelve siempre el repository: listados con `selectinload` (evita el N+1), conteos para reglas de negocio con `func.count` (p. ej. el límite de préstamos activos de un socio). Si un caso de uso encadena 3 o más lazy loads, se precarga el grafo desde el repository. Los DTOs se arman dentro de la sesión (`PrestamoDTO.from_model(...)`); nunca se devuelven objetos ORM vivos al controller ni a la vista.

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

```bash
python -m venv venv
source venv/bin/activate      # En Windows: venv\Scripts\activate
pip install -e ".[dev]"   # instala las dependencias de pyproject.toml
cp .env.example .env          # Completar la API key de Google Books
python -m app.main
```

## Integrantes

| Legajo | Nombre |
|---|---|
| 403313 | Toselli Gabriel |
| 403272 | Oliva Mateo |
| 90758 | Internicola Macarena |
| 401547 | Savarino Sofía |
| 88655 | Medina Sofía |
