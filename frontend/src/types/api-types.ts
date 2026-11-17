import type { components } from '../api/schema';

// Tipos ya expuestos por FastAPI 
export type Schemas = components['schemas'];

// Ejemplos de uso directo cuando estén montados en main.py:
// export type LibroDTO = Schemas['LibroDTO'];