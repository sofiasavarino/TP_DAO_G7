from app.controllers.ejemplar_controller import ejemplar_router
from app.controllers.libro_controller import libro_router
from app.controllers.prestamo_controller import prestamo_router
from app.controllers.remito_controller import remito_router
from app.controllers.reserva_controller import reserva_router
from app.controllers.sancion_controller import sancion_router

__all__ = ["ejemplar_router", "libro_router", "prestamo_router", "remito_router", "reserva_router", "sancion_router"]
