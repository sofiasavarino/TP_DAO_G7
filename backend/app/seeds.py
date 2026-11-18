"""Carga inicial minima del sistema.

Correr:  python -m app.seeds

Semilla 3 sedes, 3 roles (Socio/Bibliotecario/Administrador), 3 usuarios con
sus entidades vinculadas y un catalogo minimo (3 libros con ejemplares).

Es idempotente: si la base ya tiene datos, no duplica nada.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.database import SessionLocal, crear_tablas
from app.models import Base  # noqa: F401  (forzamos import para crear_tablas)
from app.models.ejemplar import Ejemplar
from app.models.empleado import Empleado
from app.models.enums import EstadoEjemplar, EstadoSocio
from app.models.libro import Libro
from app.models.rol import Rol
from app.models.sede import Sede
from app.models.socio import Socio
from app.models.usuario import Usuario
from app.utils.security import hash_password

SEDES = [
    ("Sede Centro", "Av. Rivadavia 1000, Córdoba Capital", "0351-4000001", "centro@biblio.local"),
    ("Sede Norte", "Bv. San José 1200, Córdoba", "0351-4000002", "norte@biblio.local"),
    ("Sede Sur", "San Martín 3000, Córdoba", "0351-4000003", "sur@biblio.local"),
]

ROLES = [
    ("Socio", "Usuario normal que toma libros en préstamo"),
    ("Bibliotecario", "Personal de mostrador (despacho, recepción, préstamo)"),
    ("Administrador", "Responsable del sistema"),
]

USUARIOS = [
    # nombre_usuario, password, rol, sede_idx
    ("admin1", "admin123", "Administrador", 0),
    ("bibliotecario1", "biblio123", "Bibliotecario", 0),
    ("socio1", "socio123", "Socio", 1),
]

CATALOGO = [
    # (nombre, isbn, cant_paginas, editorial, imagen_url-or-None)
    ("Cien años de soledad", "9780307474725", 417, "Sudamericana", None),
    ("Ficciones", "9789507370057", 199, "Emecé", None),
    ("Rayuela", "9788466323223", 560, "Sudamericana", None),
]


def main() -> None:
    crear_tablas()
    with SessionLocal() as session:
        if (n := session.scalar(select(Rol).limit(1))) is not None or session.scalar(select(Sede).limit(1)) is not None:
            print("La base ya tiene datos; no se duplican sedes/roles/usuarios.")
            return

        sedes = [Sede(nombre=n, direccion=d, telefono=t, email=e) for n, d, t, e in SEDES]
        session.add_all(sedes)
        session.flush()

        roles = [Rol(nombre=n, descripcion=d) for n, d in ROLES]
        session.add_all(roles)
        session.flush()

        role_map = {r.nombre: r for r in roles}
        usuarios = []
        for nombre_usuario, password, rol_nombre, sede_idx in USUARIOS:
            u = Usuario(
                nombre_usuario=nombre_usuario,
                hash=hash_password(password),
                rol_id=role_map[rol_nombre].id,
                sede_id=sedes[sede_idx].id,
            )
            usuarios.append(u)
        session.add_all(usuarios)
        session.flush()
        u_map = {u.nombre_usuario: u for u in usuarios}

        # Vincular usuarios con perfiles (Socio / Empleado)
        socio_email = "ana.prueba@example.com"
        socio = Socio(
            nombre="Ana", apellido="Pérez", dni="20123456",
            email=socio_email, estado=EstadoSocio.ACTIVO, usuario_id=u_map["socio1"].id,
        )
        session.add(socio)

        for nombre_usuario, _a, rol_nombre, _b in USUARIOS:
            if rol_nombre == "Socio":
                continue
            session.add(
                Empleado(
                    nombre="Personal", apellido=nombre_usuario.capitalize(),
                    email=f"{nombre_usuario}@biblio.local",
                    legajo=f"LEG-{nombre_usuario}",
                    usuario_id=u_map[nombre_usuario].id,
                )
            )
        session.flush()

        # Catálogo + ejemplares por libro
        libros = []
        for nombre, isbn, cant_paginas, editorial, imagen_url in CATALOGO:
            libros.append(
                Libro(
                    nombre=nombre, isbn=isbn, cant_paginas=cant_paginas,
                    editorial=editorial, imagen_url=imagen_url,
                )
            )
        session.add_all(libros)
        session.flush()

        for sede_idx, sede in enumerate(sedes):
            for libro in libros:
                session.add(
                    Ejemplar(
                        codigo_inventario=f"I-{sede_idx}-{libro.id}",
                        estado=EstadoEjemplar.DISPONIBLE,
                        libro_id=libro.id,
                        sede_origen_id=sede.id,
                        sede_actual_id=sede.id,
                    )
                )

        session.commit()
        print("Seeds cargados:")
        print(f"  Sedes: {[s.nombre for s in sedes]}")
        print(f"  Usuarios: {[u.nombre_usuario for u in usuarios]} (passwords en seeds.py)")
        print(f"  Catálogo: {[l.nombre for l in libros]}")


if __name__ == "__main__":
    main()
