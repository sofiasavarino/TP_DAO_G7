from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.repositories.base_repository import BaseRepository


class UsuarioRepository(BaseRepository[Usuario]):
    model = Usuario

    def get_by_nombre_usuario(
        self, session: Session, nombre_usuario: str, incluir_inactivos: bool = False
    ) -> Usuario | None:
        """Para el login. Precarga rol y sede porque el token y /auth/me los necesitan."""
        stmt = (
            self._select(incluir_inactivos)
            .where(Usuario.nombre_usuario == nombre_usuario)
            .options(selectinload(Usuario.rol), selectinload(Usuario.sede))
        )
        return session.scalars(stmt).first()

    def get_con_detalle(self, session: Session, usuario_id: int) -> Usuario | None:
        """Usuario con rol, sede y su perfil (socio o empleado) en pocas queries."""
        return self.get_by_id(
            session,
            usuario_id,
            selectinload(Usuario.rol),
            selectinload(Usuario.sede),
            selectinload(Usuario.socio),
            selectinload(Usuario.empleado),
        )

    def existe_nombre_usuario(self, session: Session, nombre_usuario: str) -> bool:
        return self.exists(session, Usuario.nombre_usuario == nombre_usuario)

    def existe_email(self, session: Session, email: str) -> bool:
        """Un email por cuenta (incluye usuarios dados de baja)."""
        return self.exists(session, func.lower(Usuario.email) == email.strip().lower())
    
    def listar_con_rol(
        self,
        session: Session,
        rol_nombre: str | None = None,
        incluir_inactivos: bool = True,
    ) -> list[Usuario]:
        """Listado del admin (por defecto muestra tambien los desactivados)."""
        stmt = self._select(incluir_inactivos).options(
            selectinload(Usuario.rol), selectinload(Usuario.sede)
        )
        if rol_nombre is not None:
            stmt = stmt.join(Usuario.rol).where(Rol.nombre == rol_nombre)
        return list(session.scalars(stmt.order_by(Usuario.nombre_usuario)))
