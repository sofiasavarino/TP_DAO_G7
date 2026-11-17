from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import NotificacionTipo

if TYPE_CHECKING:
    from app.models.usuario import Usuario


class Notificacion(Base):
    __tablename__ = "notificacion"

    id: Mapped[int] = mapped_column(primary_key=True)
    tipo: Mapped[NotificacionTipo] = mapped_column(
        Enum(NotificacionTipo, native_enum=False)
    )
    titulo: Mapped[str] = mapped_column(String(150))
    cuerpo: Mapped[str] = mapped_column(Text)
    leida: Mapped[bool] = mapped_column(Boolean, default=False)
    fecha_creacion: Mapped[datetime] = mapped_column(default=datetime.now)

    # Va asociado al usuario que recibe la notificación (socio, bibliotecario o admin).
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuario.id"))

    usuario: Mapped["Usuario"] = relationship(back_populates="notificaciones")
