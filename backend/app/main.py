from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.controllers.ejemplar_controller import ejemplar_router
from app.controllers.libro_controller import libro_router
from app.controllers.notificacion_controller import router as notificacion_router
from app.controllers.prestamo_controller import prestamo_router
from app.controllers.reporte_controller import reporte_router
from app.controllers.remito_controller import remito_router
from app.controllers.reserva_controller import reserva_router
from app.controllers.sancion_controller import sancion_router
from app.controllers.sede_controller import sede_router
from app.controllers.socio_controller import socio_router
from app.controllers.usuario_controller import usuario_router

from app.controllers.auth_controller import auth_router
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
app.include_router(ejemplar_router, prefix=API_PREFIX)
app.include_router(prestamo_router, prefix=API_PREFIX)
app.include_router(remito_router, prefix=API_PREFIX)
app.include_router(reserva_router, prefix=API_PREFIX)
app.include_router(sancion_router, prefix=API_PREFIX)
app.include_router(sede_router, prefix=API_PREFIX)
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(socio_router, prefix=API_PREFIX)
app.include_router(usuario_router, prefix=API_PREFIX)
app.include_router(notificacion_router, prefix=API_PREFIX)
app.include_router(reporte_router, prefix=API_PREFIX)
app.include_router(sede_router, prefix=API_PREFIX)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
