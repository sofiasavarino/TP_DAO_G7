from datetime import date

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.enums import TipoSancion


class SancionCreate(BaseModel):
    """Entrada: alta de sanción generada por el service (no es un formulario libre)."""

    prestamo_id: int
    tipo: TipoSancion
    motivo: str
    monto: float | None = None           # requerido si tipo = MULTA
    dias_suspension: int | None = None   # requerido si tipo = SUSPENSION
    fecha_inicio: date | None = None     # el service default a hoy

    @model_validator(mode="after")
    def validar_coherencia_tipo(self) -> "SancionCreate":
        if self.tipo is TipoSancion.MULTA and self.monto is None:
            raise ValueError("La sanción de tipo MULTA requiere `monto`")
        if self.tipo is TipoSancion.SUSPENSION and not self.dias_suspension:
            raise ValueError("La sanción de tipo SUSPENSION requiere `dias_suspension`")
        return self


class SancionDTO(BaseModel):
    """Salida: ficha de sanción (también para resumen en ficha de socio)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo: TipoSancion
    motivo: str
    monto: float | None = None
    dias_suspension: int | None = None
    fecha_inicio: date
    fecha_fin: date | None = None
    socio_id: int
    prestamo_id: int
