from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.controllers.libro_controller import libro_router

API_PREFIX = "/api/v1"

app = FastAPI(title="Sistema de Gestión de Biblioteca — Grupo 7")

# Para desarrollo con el frontend (Vite) en localhost. En producción ajustar.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(libro_router, prefix=API_PREFIX)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
