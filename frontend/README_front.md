# Frontend – Sistema de Gestión de Biblioteca (SPA)

Aplicación web única (SPA) construida con **React + Vite + TypeScript**, diseñada con diferenciación de vistas y permisos según el rol del usuario autenticado (`Socio`, `Bibliotecario`, `Administrador`).

---

## 1. Requisitos previos

* **Node.js** (v18 o superior) y **npm**.
* **Backend corriendo** en paralelo para probar peticiones reales o actualizar tipos (`http://localhost:8000`).

---

## 2. Instalación y puesta en marcha (Primera vez)

1. Abrí una terminal y entrá a la carpeta `frontend/`:
   ```bash
   cd frontend
   ```

2. Instalá todas las dependencias del proyecto (incluyendo `openapi-typescript`):
   ```bash
   npm install
   ```

3. Creá tu archivo de variables de entorno local copiando la plantilla `.env.example`:
   ```bash
   cp .env.example .env
   ```
   > **Nota:** El archivo `.env` está ignorado por Git (`.gitignore`). Por defecto apunta a `VITE_API_URL=http://localhost:8000`. Si probás el backend en otro puerto o IP local, cambialo únicamente en tu `.env` sin tocar `.env.example`.

4. Levantá el servidor de desarrollo de Vite:
   ```bash
   npm run dev
   ```
   La aplicación quedará disponible en **`http://localhost:5173`**.

---

## 3. Comandos disponibles (`package.json`)

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo en `http://localhost:5173` con recarga automática. |
| `npm run gen:types` | Regenera `src/api/schema.d.ts` leyendo los DTOs y endpoints en vivo desde FastAPI (`/openapi.json`). |
| `npm run build` | Compila TypeScript (`tsc`) y genera el bundle de producción. Útil para verificar que no haya errores de tipos antes de hacer commit. |

---

## 4. Sincronización automática de tipos con el Backend

Para evitar escribir interfaces a mano y asegurar que el frontend y el backend coincidan al 100%, los tipos de los DTOs de Pydantic se generan automáticamente en **`src/api/schema.d.ts`**.

### ¿Cuándo y cómo actualizar los tipos?
Cada vez que el equipo de backend agregue o modifique un endpoint o DTO en `backend/app/controllers/` o `backend/app/dtos/`:

1. **Terminal 1 (Backend):** Asegurate de tener el entorno virtual activado y Uvicorn corriendo sin errores:
   ```bash
   cd backend
   source ../.venv/bin/activate   # En Windows: ..\.venv\Scripts\activate
   uvicorn app.main:app --reload
   ```
2. **Terminal 2 (Frontend):** Con el servidor prendido, ejecutá:
   ```bash
   cd frontend
   npm run gen:types
   ```
3. Revisá los cambios en `src/api/schema.d.ts` y subilos junto con tu código en Git.

> ⚠️ **Importante:** Nunca edites `src/api/schema.d.ts` manualmente, ya que se sobrescribe cada vez que se ejecuta `npm run gen:types`.

---

## 5. Estructura del proyecto (`frontend/src/`)

```text
frontend/
├── .env                  # Variables de entorno locales (NO se sube a Git)
├── .env.example          # Plantilla de variables de entorno (SÍ se sube a Git)
├── package.json
└── src/
    ├── api/
    │   └── schema.d.ts   # Tipos y rutas autogenerados desde FastAPI (OpenAPI)
    ├── types/
    │   └── enums.ts      # Enums del dominio (estados y tipos exactos del backend)
    ├── services/
    │   ├── api.ts        # Cliente HTTP base (fetch + JWT + manejo de errores)
    │   └── *.ts          # Servicios por recurso (librosService.ts, reservasService.ts, etc.)
    ├── context/
    │   └── AuthContext.tsx # Estado global de sesión, token JWT y rol del usuario
    ├── components/       # Componentes reutilizables (modales, tarjetas, rutas protegidas)
    └── pages/            # Pantallas separadas por vista (Socio vs. Bibliotecario/Admin)
```

---

## 6. Guía rápida de desarrollo (Cómo conectar pantallas)

### A. Usar los tipos autogenerados (`schema.d.ts`) y los Enums (`enums.ts`)
En tus servicios o componentes, importá los DTOs desde `schema.d.ts` y los estados desde `enums.ts`:

```ts
import type { components } from '../api/schema';
import { EjemplarEstado, ReservaEstado } from '../types/enums';

// Alias limpio para usar el DTO del backend
type LibroDTO = components['schemas']['LibroDTO'];

// Comparación segura usando Enums
if (ejemplar.estado === EjemplarEstado.DISPONIBLE) {
  // Mostrar botón de reservar
}
```

### B. Hacer peticiones HTTP usando `src/services/api.ts`
No uses `fetch` directo en los componentes. Usá siempre el cliente `api` de `src/services/api.ts`, ya que:
1. Antepone automáticamente `VITE_API_URL`.
2. Adjunta la cabecera `Authorization: Bearer <token>` si hay sesión iniciada.
3. Captura los errores HTTP de FastAPI y extrae el mensaje de negocio (`detail`) lanzando un `ApiError`.

```ts
import { api, ApiError } from './api';
import type { components } from '../api/schema';

type LibroDTO = components['schemas']['LibroDTO'];

export const librosService = {
  listar: (titulo?: string) =>
    api.get<LibroDTO[]>('/libros', { titulo }),

  crear: (payload: LibroCreateDTO) =>
    api.post<LibroDTO>('/libros', payload),
};
```

### C. Manejar errores de reglas de negocio en los componentes
Cuando el backend rechaza una acción (por ejemplo: `SocioSancionado` o `LimitePrestamosExcedido`), `api.ts` lanza un `ApiError` con el mensaje listo para mostrar al usuario:

```ts
try {
  await reservasService.crear({ libro_id: 1, sede_retiro_id: 2 });
} catch (error) {
  if (error instanceof ApiError) {
    setErrorMsg(error.message); // Muestra el "detail" exacto enviado por FastAPI
  }
}
```

---

## 7. Flujo de trabajo diario recomendado para el equipo

1. **Actualizar el repositorio:** Antes de empezar a programar, hacé `git pull` en tu rama.
2. **Levantar ambos servidores:**
   * Terminal 1 (`backend/`): `uvicorn app.main:app --reload`
   * Terminal 2 (`frontend/`): `npm run dev`
3. **Sincronizar tipos (si hubo cambios en el backend):** Corré `npm run gen:types` en `frontend/`.
4. **Desarrollar tu módulo:**
   * Creá las llamadas en `src/services/<entidad>Service.ts`.
   * Consumí el servicio desde tu página o componente en `src/pages/` o `src/components/`.
   * Asegurate de manejar estados de carga (`loading`) y mensajes de error (`ApiError`).
5. **Verificar antes de commitear:** Corré `npm run build` en `frontend/` para confirmar que TypeScript compila sin errores y que no subís archivos temporales ni `.env`.
```

Ya tenés listo el archivo **`frontend/README.md`** con todo el flujo documentado paso a paso para tus compañeros. Si querés, el siguiente paso es revisar qué endpoints quedaron generados en `src/api/schema.d.ts` para armar **F1.5** (el primer servicio de libros/catálogo).