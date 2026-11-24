"""El reset de contraseña por admin notifica a socios y a bibliotecarios."""

from app.models.empleado import Empleado
from app.models.enums import EstadoSocio, NotificacionTipo
from app.models.notificacion import Notificacion
from app.models.rol import Rol
from app.models.sede import Sede
from app.models.socio import Socio
from app.models.usuario import Usuario
from app.services.usuario_service import restablecer_password_admin

CLAVE = 'NuevaClave123'


def _contexto(session):
    sede = Sede(nombre='Centro', direccion='Calle 1')
    session.add(sede)
    session.flush()
    rol_socio = Rol(nombre='Socio', descripcion='socio')
    rol_biblio = Rol(nombre='Bibliotecario', descripcion='personal')
    session.add_all([rol_socio, rol_biblio])
    session.flush()

    u_socio = Usuario(
        nombre_usuario='socio', email='s@test.com', hash='x',
        rol_id=rol_socio.id, sede_id=sede.id,
    )
    u_biblio = Usuario(
        nombre_usuario='biblio', email='b@test.com', hash='x',
        rol_id=rol_biblio.id, sede_id=sede.id,
    )
    session.add_all([u_socio, u_biblio])
    session.flush()
    session.add(
        Socio(
            nombre='Ana', apellido='Pérez', dni='11111111',
            estado=EstadoSocio.ACTIVO, usuario_id=u_socio.id,
        )
    )
    session.add(
        Empleado(nombre='Bib', apellido='Lio', legajo='LEG-1', usuario_id=u_biblio.id)
    )
    session.flush()
    return u_socio, u_biblio


def _notificaciones(session, usuario_id):
    return list(
        session.query(Notificacion).filter_by(
            usuario_id=usuario_id, tipo=NotificacionTipo.PASSWORD_REESTABLECIDA
        )
    )


def test_reset_admin_notifica_al_socio(session):
    u_socio, _u_biblio = _contexto(session)
    assert restablecer_password_admin(session, u_socio.id, CLAVE) is True

    notificaciones = _notificaciones(session, u_socio.id)
    assert len(notificaciones) == 1
    assert notificaciones[0].titulo == 'Tu contraseña fue reestablecida'
    assert CLAVE not in notificaciones[0].cuerpo  # nunca va la clave en el mail


def test_reset_admin_notifica_tambien_al_bibliotecario(session):
    _u_socio, u_biblio = _contexto(session)
    assert restablecer_password_admin(session, u_biblio.id, CLAVE) is True

    notificaciones = _notificaciones(session, u_biblio.id)
    assert len(notificaciones) == 1


def test_reset_de_usuario_inexistente_no_notifica(session):
    _contexto(session)
    assert restablecer_password_admin(session, 9999, CLAVE) is False
    assert session.query(Notificacion).count() == 0
