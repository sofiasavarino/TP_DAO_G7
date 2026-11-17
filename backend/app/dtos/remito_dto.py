from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.enums import EstadoRemito, TipoTraslado


class RemitoCreate(BaseModel):
    """Entrada: alta de remito interbibliotecario. Los responsables se completan por flujo."""

    numero_remito: str
    caracter_traslado: TipoTraslado
    sede_origen_id: int
    sede_destino_id: int
    observaciones: str | None = None


class RemitoListadoDTO(BaseModel):
    """Salida: tablero/alta de despachos y recepciones."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    numero_remito: str
    caracter_traslado: TipoTraslado
    estado: EstadoRemito
    sede_origen_id: int
    sede_destino_id: int
    fecha_creacion: date
    fecha_despacho: date | None = None
    fecha_recepcion: date | None = None


class RemitoDetalleDTO(BaseModel):
    """Salida: vista completa del remito."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    numero_remito: str
    caracter_traslado: TipoTraslado
    estado: EstadoRemito
    observaciones: str | None = None
    sede_origen_id: int
    sede_destino_id: int
    responsable_creacion_id: int
    responsable_despacho_id: int | None = None
    responsable_recepcion_id: int | None = None
    fecha_creacion: date
    fecha_despacho: date | None = None
    fecha_recepcion: date | None = None
