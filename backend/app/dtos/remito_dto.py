from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.enums import EstadoEjemplar, EstadoRemito, MotivoTraslado


class RemitoCreate(BaseModel):
    """Entrada: alta de remito interbibliotecario. Responsables se completan por flujo.

    `numero_remito` es opcional: si no viene, el service lo autogenera `R-YYYYMMDD-NNN`.
    """

    numero_remito: str | None = None
    motivo_traslado: MotivoTraslado
    sede_origen_id: int
    sede_destino_id: int
    ejemplar_ids: list[int] = []
    observaciones: str | None = None


class IncidenciaItemDTO(BaseModel):
    """Daño informado al recibir un ejemplar. Solo EN_REPARACION o INUTILIZABLE (validado en el servicio)."""

    ejemplar_id: int
    estado: EstadoEjemplar


class EjemplarEnRemitoDTO(BaseModel):
    """Información mínima del ejemplar para validar en despacho y recepción."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo_inventario: str
    descripcion_fisica: str | None = None
    libro_nombre: str


class RemitoListadoDTO(BaseModel):
    """Salida: tablero/alta de despachos y recepciones."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    numero_remito: str
    motivo_traslado: MotivoTraslado
    estado: EstadoRemito
    sede_origen_id: int
    sede_destino_id: int
    ejemplares_count: int
    fecha_creacion: date
    fecha_despacho: date | None = None
    fecha_recepcion: date | None = None


class RemitoDetalleDTO(BaseModel):
    """Salida: vista completa del remito (incluye ejemplares)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    numero_remito: str
    motivo_traslado: MotivoTraslado
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
    ejemplares: list[EjemplarEnRemitoDTO] = []
