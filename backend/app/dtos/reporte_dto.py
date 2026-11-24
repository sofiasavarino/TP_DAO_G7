"""DTOs de salida de los reportes de gestión (solo lectura, agregados)."""

from datetime import date

from pydantic import BaseModel


class DisponibilidadSedeDTO(BaseModel):
    sede_id: int
    sede: str
    disponibles: int
    total: int
    porcentaje: float  # disponibles / total * 100


class EficaciaLogisticaDTO(BaseModel):
    creados: int
    en_transito: int
    recibidos: int
    con_incidencia: int
    finalizados: int  # recibidos + con incidencia
    tasa_exito_porcentaje: float  # recibidos / finalizados * 100


class MovimientoSedeDTO(BaseModel):
    origen: str
    destino: str
    remitos: int
    ejemplares: int
    dias_promedio: float | None


class LibroSolicitadoDTO(BaseModel):
    libro_id: int
    libro: str
    cantidad: int


class EstadoColeccionDTO(BaseModel):
    estado: str
    cantidad: int
    porcentaje: float  # cantidad / total de ejemplares * 100


class CumplimientoRetiroDTO(BaseModel):
    cumplidas: int
    vencidas: int
    canceladas: int
    tasa_cumplimiento_porcentaje: float  # cumplidas / (cumplidas + vencidas + canceladas) * 100


class EsperaReservaDTO(BaseModel):
    sede_id: int
    sede: str
    reservas: int
    dias_promedio: float | None


class CargaSedeDTO(BaseModel):
    sede_id: int
    sede: str
    prestamos_activos: int
    remitos_en_transito: int
    ejemplares_en_transito: int


class MultaSocioDTO(BaseModel):
    socio_id: int
    socio: str
    cantidad: int
    monto_total: float


class MultasAcumuladasDTO(BaseModel):
    total: float
    socios: list[MultaSocioDTO]


class PresionLibroDTO(BaseModel):
    libro_id: int
    libro: str
    reservas_esperando: int
    ejemplares: int
    ratio: float  # reservas / ejemplares


class UsoGeneroSedeDTO(BaseModel):
    genero: str
    sede: str
    prestamos: int


class VencidoSinSancionDTO(BaseModel):
    numero: str
    socio: str
    libro: str
    fecha_vencimiento: date


class VencidosSinSancionDTO(BaseModel):
    cantidad: int
    prestamos: list[VencidoSinSancionDTO]
