"""Datos de DEMO: deja la base en un estado "vivido" para mostrar las funcionalidades
que dependen del paso del tiempo (vencimientos, multas, suspensiones, pérdidas,
ventanas de retiro, remitos en viaje, reportes con historia).

Uso, desde `backend/`:

    python -m app.seed_demo            # agrega la demo sobre la base actual
    python -m app.seed_demo --reset    # BORRA la base, corre app.seeds y carga la demo

Todas las fechas son RELATIVAS a hoy (date.today()), así que conviene correrlo con
--reset el mismo día de la presentación: si se cargó hace una semana, los "vence en
2 días" ya estarán vencidos.

Si se usa el catálogo de Google Books, correr `python -m app.seed_catalogo_google`
ANTES que este script (los libros de la demo se reutilizan por nombre si ya existen).

Es idempotente: si ya existe el usuario `bruno`, no hace nada.

Usuarios que crea (todos los socios con contraseña `socio123`):
    bibliotecario2 / biblio123  (Sede Norte)    bibliotecario3 / biblio123  (Sede Sur)
    socio1   Ana       préstamo que vence en 2 días + reserva LISTA para retirar (cupo lleno)
    bruno    Bruno     préstamo VENCIDO hace 10 días, sin sanción (devolver => multa automática)
    carla    Carla     MULTA impaga (abonar => suspensión de 15 días)
    diego    Diego     SUSPENDIDO por devolver con daños (le quedan ~10 días)
    elena    Elena     préstamo vencido hace más de 2 meses (marcar como PERDIDO)
    federico Federico  dado de BAJA por libro perdido (reponer libro / devolver si aparece)
    gabriela Gabriela  reserva LISTA cuya ventana de retiro ya venció (procesar vencimientos)
    hernan   Hernán    reserva PENDIENTE: la hereda cuando vence la de Gabriela (FIFO)
    ines     Inés      reserva PENDIENTE en otra sede del mismo libro (remito automático)
    julian   Julián    préstamo activo NO renovable (hay cola de reservas)
    karina   Karina    reserva EN_TRANSITO con remito despachado (recibir en Sede Sur)
    lucas    Lucas     reserva PENDIENTE con remito CREADO (despachar desde Sede Sur)
"""

from __future__ import annotations

import sys
from datetime import date, datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config.database import SessionLocal, engine
from app.models import Base
from app.models.autor import Autor
from app.models.ejemplar import Ejemplar
from app.models.empleado import Empleado
from app.models.enums import (
    EstadoEjemplar,
    EstadoPrestamo,
    EstadoRemito,
    EstadoReserva,
    EstadoSocio,
    MotivoTraslado,
    NotificacionTipo,
    TipoPrestamo,
    TipoSancion,
)
from app.models.libro import Libro
from app.models.notificacion import Notificacion
from app.models.prestamo import Prestamo
from app.models.remito import Remito
from app.models.reserva import Reserva
from app.models.rol import Rol
from app.models.sancion import Sancion
from app.models.sede import Sede
from app.models.socio import Socio
from app.models.usuario import Usuario
from app.utils.fechas import dias_habiles_entre, sumar_dias_habiles
from app.utils.security import hash_password

# Mismas reglas que prestamo_service / sancion_service
DIAS_PRESTAMO = 15
DIAS_SUSPENSION = 15
MULTA_BASE = 5000.0
MULTA_INTERES_DIARIO = 0.02

HOY = date.today()


def d(dias: int) -> date:
    """Fecha relativa a hoy: d(-3) = hace 3 días, d(2) = dentro de 2 días."""
    return HOY + timedelta(days=dias)


def multa_por_retraso(vencimiento: date, devolucion: date) -> tuple[int, float]:
    dias = dias_habiles_entre(vencimiento, devolucion)
    return dias, round(MULTA_BASE * ((1 + MULTA_INTERES_DIARIO) ** dias), 2)


# (nombre, autor, editorial, fecha_publicacion, genero, paginas)
LIBROS_DEMO = {
    "tunel": ("El túnel", "Ernesto Sabato", "Seix Barral", date(1948, 1, 1), "Novela", 160),
    "pedro": ("Pedro Páramo", "Juan Rulfo", "Fondo de Cultura Económica", date(1955, 1, 1), "Realismo mágico", 132),
    "casa": ("La casa de los espíritus", "Isabel Allende", "Plaza & Janés", date(1982, 1, 1), "Realismo mágico", 448),
    "quijote": ("Don Quijote de la Mancha", "Miguel de Cervantes", "Alfaguara", date(2004, 1, 1), "Clásico", 1376),
    "fierro": ("Martín Fierro", "José Hernández", "Losada", date(1872, 12, 1), "Poesía", 240),
    "principito": ("El principito", "Antoine de Saint-Exupéry", "Salamandra", date(1943, 4, 6), "Infantil", 96),
}

# (usuario, nombre, apellido, dni, sede)
SOCIOS_DEMO = [
    ("bruno", "Bruno", "Díaz", "30111222", "Centro"),
    ("carla", "Carla", "Gómez", "30222333", "Centro"),
    ("diego", "Diego", "Fernández", "30333444", "Sur"),
    ("elena", "Elena", "Martínez", "30444555", "Norte"),
    ("federico", "Federico", "López", "30555666", "Centro"),
    ("gabriela", "Gabriela", "Sosa", "30666777", "Centro"),
    ("hernan", "Hernán", "Ruiz", "30777888", "Centro"),
    ("ines", "Inés", "Castro", "30888999", "Norte"),
    ("julian", "Julián", "Romero", "30999000", "Sur"),
    ("karina", "Karina", "Molina", "31000111", "Sur"),
    ("lucas", "Lucas", "Herrera", "31111222", "Norte"),
]


class Demo:
    def __init__(self, session: Session) -> None:
        self.s = session
        self.sedes = {
            s.nombre.replace("Sede ", ""): s for s in session.scalars(select(Sede))
        }
        self.roles = {r.nombre: r for r in session.scalars(select(Rol))}
        self.nro_prestamo = int(session.scalar(select(func.count(Prestamo.id))) or 0)
        self.nros_remito = set(session.scalars(select(Remito.numero_remito)))

    # ------------------------------------------------------------------ helpers

    def usuario(self, nombre_usuario: str) -> Usuario:
        u = self.s.scalar(select(Usuario).where(Usuario.nombre_usuario == nombre_usuario))
        if u is None:
            raise RuntimeError(f"Falta el usuario '{nombre_usuario}': corré antes `python -m app.seeds`.")
        return u

    def nuevo_usuario(self, nombre_usuario: str, password: str, rol: str, sede: str) -> Usuario:
        u = Usuario(
            nombre_usuario=nombre_usuario,
            email=f"{nombre_usuario}@example.com",
            hash=hash_password(password),
            rol_id=self.roles[rol].id,
            sede_id=self.sedes[sede].id,
        )
        self.s.add(u)
        self.s.flush()
        return u

    def autor(self, nombre: str) -> Autor:
        a = self.s.scalar(select(Autor).where(func.lower(Autor.nombre) == nombre.lower()))
        if a is None:
            a = Autor(nombre=nombre)
            self.s.add(a)
            self.s.flush()
        return a

    def libro_por_nombre(self, nombre: str) -> Libro | None:
        return self.s.scalar(select(Libro).where(func.lower(Libro.nombre) == nombre.lower()))

    def libro(self, clave: str) -> Libro:
        nombre, autor, editorial, publicado, genero, paginas = LIBROS_DEMO[clave]
        libro = self.libro_por_nombre(nombre)
        if libro is None:
            libro = Libro(
                nombre=nombre, editorial=editorial, fecha_publicacion=publicado,
                genero=genero, cant_paginas=paginas,
            )
            libro.autores.append(self.autor(autor))
            self.s.add(libro)
            self.s.flush()
        elif libro.fecha_publicacion is None:
            libro.fecha_publicacion = publicado  # la reposición compara ediciones por fecha
        return libro

    def ejemplar(
        self, codigo: str, libro: Libro, sede: str,
        estado: EstadoEjemplar = EstadoEjemplar.DISPONIBLE, sede_actual: str | None = None,
    ) -> Ejemplar:
        e = Ejemplar(
            codigo_inventario=f"DEMO-{codigo}",
            estado=estado,
            libro_id=libro.id,
            sede_origen_id=self.sedes[sede].id,
            sede_actual_id=self.sedes[sede_actual or sede].id,
            descripcion_fisica="Ejemplar de demostración",
        )
        self.s.add(e)
        self.s.flush()
        return e

    def ejemplar_base(self, libro: Libro, sede: str) -> Ejemplar:
        """Ejemplar creado por app.seeds (o Google) para ese libro y sede de origen."""
        e = self.s.scalar(
            select(Ejemplar).where(
                Ejemplar.libro_id == libro.id,
                Ejemplar.sede_origen_id == self.sedes[sede].id,
                ~Ejemplar.codigo_inventario.like("DEMO-%"),
            ).order_by(Ejemplar.id)
        )
        if e is None:  # por si alguien borró los del seed: se crea uno
            e = self.ejemplar(f"{libro.id}-{sede[0]}", libro, sede)
        return e

    def prestamo(
        self, socio: Socio, ejemplar: Ejemplar, inicio: date, *,
        devuelto: date | None = None, estado: EstadoPrestamo | None = None,
        tipo: TipoPrestamo = TipoPrestamo.LOCAL, vence: date | None = None,
        observaciones: str | None = None,
    ) -> Prestamo:
        self.nro_prestamo += 1
        if estado is None:
            estado = EstadoPrestamo.FINALIZADO if devuelto else EstadoPrestamo.ACTIVO
        p = Prestamo(
            numero=f"P-{self.nro_prestamo:06d}",
            tipo=tipo,
            estado=estado,
            fecha_inicio=inicio,
            fecha_vencimiento=vence or inicio + timedelta(days=DIAS_PRESTAMO),
            fecha_devolucion=devuelto,
            observaciones=observaciones,
            socio_id=socio.id,
            ejemplar_id=ejemplar.id,
        )
        self.s.add(p)
        self.s.flush()
        return p

    def reserva(
        self, socio: Socio, libro: Libro, sede: str, fecha: date, estado: EstadoReserva, *,
        ejemplar: Ejemplar | None = None, asignada: date | None = None,
        vence_retiro: date | None = None,
    ) -> Reserva:
        if asignada is not None and vence_retiro is None:
            vence_retiro = sumar_dias_habiles(asignada, 2)
        r = Reserva(
            fecha_reserva=fecha,
            fecha_asignacion=asignada,
            fecha_vencimiento_retiro=vence_retiro,
            estado=estado,
            socio_id=socio.id,
            libro_id=libro.id,
            sede_retiro_id=self.sedes[sede].id,
            ejemplar_id=ejemplar.id if ejemplar else None,
        )
        self.s.add(r)
        self.s.flush()
        return r

    def remito(
        self, origen: str, destino: str, ejemplares: list[Ejemplar], estado: EstadoRemito, *,
        creado: date, despachado: date | None = None, recibido: date | None = None,
        motivo: MotivoTraslado = MotivoTraslado.IDA, observaciones: str | None = None,
    ) -> Remito:
        n = 1
        while (numero := f"R-{creado:%Y%m%d}-{n:03d}") in self.nros_remito:
            n += 1
        self.nros_remito.add(numero)
        biblio = {
            "Centro": self.usuario("bibliotecario1"),
            "Norte": self.usuario("bibliotecario2"),
            "Sur": self.usuario("bibliotecario3"),
        }
        r = Remito(
            numero_remito=numero,
            motivo_traslado=motivo,
            observaciones=observaciones,
            estado=estado,
            fecha_creacion=creado,
            fecha_despacho=despachado,
            fecha_recepcion=recibido,
            sede_origen_id=self.sedes[origen].id,
            sede_destino_id=self.sedes[destino].id,
            responsable_creacion_id=biblio[origen].id,
            responsable_despacho_id=biblio[origen].id if despachado else None,
            responsable_recepcion_id=biblio[destino].id if recibido else None,
        )
        r.ejemplares.extend(ejemplares)
        self.s.add(r)
        self.s.flush()
        return r

    def sancion(
        self, socio: Socio, prestamo: Prestamo, tipo: TipoSancion, inicio: date, motivo: str, *,
        fin: date | None = None, monto: float | None = None, dias: int | None = None,
        activo: bool = True,
    ) -> Sancion:
        s = Sancion(
            tipo=tipo, fecha_inicio=inicio, fecha_fin=fin, motivo=motivo, monto=monto,
            dias_suspension=dias, socio_id=socio.id, prestamo_id=prestamo.id, activo=activo,
        )
        self.s.add(s)
        self.s.flush()
        return s

    def notificar(
        self, socio: Socio, tipo: NotificacionTipo, titulo: str, cuerpo: str,
        cuando: date, leida: bool = False,
    ) -> None:
        self.s.add(
            Notificacion(
                tipo=tipo, titulo=titulo, cuerpo=cuerpo, leida=leida,
                fecha_creacion=datetime.combine(cuando, time(10, 30)),
                usuario_id=socio.usuario_id,
            )
        )

    # ------------------------------------------------------------------ carga

    def cargar(self) -> None:
        s = self.s

        # --- Personal: un bibliotecario por sede (para despachar/recibir remitos)
        for nombre_usuario, sede in (("bibliotecario2", "Norte"), ("bibliotecario3", "Sur")):
            u = self.nuevo_usuario(nombre_usuario, "biblio123", "Bibliotecario", sede)
            s.add(Empleado(nombre="Personal", apellido=nombre_usuario.capitalize(),
                           legajo=f"LEG-{nombre_usuario}", usuario_id=u.id))

        # --- Socios
        socios: dict[str, Socio] = {"ana": self.usuario("socio1").socio}
        if socios["ana"] is None:
            raise RuntimeError("socio1 no tiene Socio asociado: corré antes `python -m app.seeds`.")
        for nombre_usuario, nombre, apellido, dni, sede in SOCIOS_DEMO:
            u = self.nuevo_usuario(nombre_usuario, "socio123", "Socio", sede)
            socio = Socio(nombre=nombre, apellido=apellido, dni=dni,
                          telefono="351-555-0" + dni[-3:], usuario_id=u.id)
            s.add(socio)
            socios[nombre_usuario] = socio
        s.flush()
        ana, bruno, carla, diego = socios["ana"], socios["bruno"], socios["carla"], socios["diego"]
        elena, federico, gabriela, hernan = socios["elena"], socios["federico"], socios["gabriela"], socios["hernan"]
        ines, julian, karina, lucas = socios["ines"], socios["julian"], socios["karina"], socios["lucas"]

        # --- Libros (los 3 de app.seeds + 6 de la demo)
        cien = self.libro_por_nombre("Cien años de soledad")
        fic = self.libro_por_nombre("Ficciones")
        ray = self.libro_por_nombre("Rayuela")
        if not (cien and fic and ray):
            raise RuntimeError("Faltan los libros de app.seeds: corré antes `python -m app.seeds`.")
        tunel, pedro, casa = self.libro("tunel"), self.libro("pedro"), self.libro("casa")
        quijote, fierro, principito = self.libro("quijote"), self.libro("fierro"), self.libro("principito")

        E = EstadoEjemplar
        cien_c, cien_n, cien_s = (self.ejemplar_base(cien, x) for x in ("Centro", "Norte", "Sur"))
        fic_c, fic_s = self.ejemplar_base(fic, "Centro"), self.ejemplar_base(fic, "Sur")
        ray_c, ray_n, ray_s = (self.ejemplar_base(ray, x) for x in ("Centro", "Norte", "Sur"))

        pp_c1 = self.ejemplar("PP-C1", pedro, "Centro", E.PRESTADO)
        pp_c2 = self.ejemplar("PP-C2", pedro, "Centro", E.RESERVADO)
        pp_s1 = self.ejemplar("PP-S1", pedro, "Sur", E.PRESTADO)
        tu_n1 = self.ejemplar("TU-N1", tunel, "Norte", E.RESERVADO)
        tu_c1 = self.ejemplar("TU-C1", tunel, "Centro", E.EN_TRANSITO)
        tu_c2 = self.ejemplar("TU-C2", tunel, "Centro")
        ce_c1 = self.ejemplar("CE-C1", casa, "Centro")
        ce_s1 = self.ejemplar("CE-S1", casa, "Sur", E.RESERVADO)
        self.ejemplar("CE-S2", casa, "Sur")
        qu_s1 = self.ejemplar("QU-S1", quijote, "Sur", E.EN_REPARACION)
        qu_c1 = self.ejemplar("QU-C1", quijote, "Centro")
        qu_n1 = self.ejemplar("QU-N1", quijote, "Norte", sede_actual="Sur")  # rebalanceado
        mf_n1 = self.ejemplar("MF-N1", fierro, "Norte", E.PRESTADO)
        mf_s1 = self.ejemplar("MF-S1", fierro, "Sur")
        mf_c1 = self.ejemplar("MF-C1", fierro, "Centro", E.INUTILIZABLE, sede_actual="Sur")
        pr_c1 = self.ejemplar("PR-C1", principito, "Centro", E.PERDIDO)
        pr_n1 = self.ejemplar("PR-N1", principito, "Norte")
        pr_s1 = self.ejemplar("PR-S1", principito, "Sur")

        L, I = TipoPrestamo.LOCAL, TipoPrestamo.INTERBIBLIOTECARIO
        R = EstadoReserva
        N = NotificacionTipo

        # ============================================================ HISTORIA (reportes)
        # Préstamos devueltos en término, repartidos en sedes y géneros.
        for socio, ej, ini, dev in [
            (lucas, cien_n, -100, -88), (karina, cien_s, -85, -72), (gabriela, ce_c1, -80, -68),
            (bruno, cien_c, -75, -63), (hernan, ray_c, -70, -58), (julian, ray_s, -65, -52),
            (ana, cien_n, -60, -47), (diego, cien_s, -55, -42), (bruno, ray_c, -50, -38),
            (lucas, qu_n1, -50, -37), (julian, fic_s, -60, -49), (ines, pr_n1, -45, -33),
            (hernan, qu_c1, -30, -18), (karina, pr_s1, -28, -15), (ines, cien_n, -20, -8),
            (carla, fic_c, -90, -80), (ana, ray_n, -35, -22),
        ]:
            self.prestamo(socio, ej, d(ini), devuelto=d(dev))

        # Reservas cumplidas locales (espera promedio por sede)
        self.reserva(ines, principito, "Norte", d(-47), R.CUMPLIDA, ejemplar=pr_n1, asignada=d(-46))
        self.reserva(hernan, quijote, "Centro", d(-31), R.CUMPLIDA, ejemplar=qu_c1, asignada=d(-31))
        self.reserva(karina, principito, "Sur", d(-31), R.CUMPLIDA, ejemplar=pr_s1, asignada=d(-29))

        # Interbibliotecario 1: Ficciones Centro -> Norte para Ana (el ejemplar se queda en Norte)
        self.reserva(ana, fic, "Norte", d(-45), R.CUMPLIDA, ejemplar=fic_c, asignada=d(-41))
        self.remito("Centro", "Norte", [fic_c], EstadoRemito.RECIBIDO,
                    creado=d(-44), despachado=d(-43), recibido=d(-41))
        self.prestamo(ana, fic_c, d(-40), devuelto=d(-27), tipo=I)
        fic_c.sede_actual_id = self.sedes["Norte"].id
        self.notificar(ana, N.RESERVA_LISTA, "Tu ejemplar está listo",
                       f"«{fic.nombre}» ({fic_c.codigo_inventario}) te espera en Sede Norte por 48 hs hábiles.",
                       d(-41), leida=True)

        # Interbibliotecario 2: Ficciones Sur -> Norte para Lucas
        self.reserva(lucas, fic, "Norte", d(-27), R.CUMPLIDA, ejemplar=fic_s, asignada=d(-22))
        self.remito("Sur", "Norte", [fic_s], EstadoRemito.RECIBIDO,
                    creado=d(-26), despachado=d(-25), recibido=d(-22))
        self.prestamo(lucas, fic_s, d(-21), devuelto=d(-9), tipo=I)
        fic_s.sede_actual_id = self.sedes["Norte"].id
        self.notificar(lucas, N.RESERVA_LISTA, "Tu ejemplar está listo",
                       f"«{fic.nombre}» ({fic_s.codigo_inventario}) te espera en Sede Norte por 48 hs hábiles.",
                       d(-22), leida=True)

        # Rebalanceo Norte -> Sur (sin préstamo) y remito con incidencia (llegó destruido)
        self.remito("Norte", "Sur", [qu_n1], EstadoRemito.RECIBIDO, creado=d(-12),
                    despachado=d(-11), recibido=d(-8), motivo=MotivoTraslado.REBALANCEO)
        self.remito("Centro", "Sur", [mf_c1], EstadoRemito.CON_INCIDENCIA, creado=d(-33),
                    despachado=d(-32), recibido=d(-29), motivo=MotivoTraslado.REBALANCEO,
                    observaciones=f"{mf_c1.codigo_inventario}: llegó mojado y con hojas sueltas; se da de baja.")

        # Reserva vencida (Carla no la retiró) y reserva cancelada
        self.reserva(carla, tunel, "Centro", d(-40), R.VENCIDA, ejemplar=tu_c2,
                     asignada=d(-39), vence_retiro=d(-37))
        self.notificar(carla, N.RESERVA_VENCIDA, "Tu reserva venció",
                       f"Pasó el plazo para retirar «{tunel.nombre}». Si todavía lo querés, podés volver a reservarlo.",
                       d(-36), leida=True)
        self.reserva(hernan, quijote, "Centro", d(-25), R.CANCELADA)

        # Diego: multa vieja ya abonada + su suspensión posterior ya cumplida
        p = self.prestamo(diego, mf_s1, d(-105), devuelto=d(-80))
        dias, monto = multa_por_retraso(p.fecha_vencimiento, d(-80))
        motivo = f"Devolución tardía del préstamo {p.numero} ({dias} día(s) hábiles de retraso)"
        self.sancion(diego, p, TipoSancion.MULTA, d(-80), motivo, monto=monto, fin=d(-78), activo=False)
        self.sancion(diego, p, TipoSancion.SUSPENSION, d(-78),
                     f"Suspensión posterior al pago de la multa: {motivo}",
                     fin=d(-78 + DIAS_SUSPENSION), dias=DIAS_SUSPENSION)
        self.notificar(diego, N.SANCION_APLICADA, "Se te aplicó una sanción",
                       f"Multa de ${monto:.2f}. Motivo: {motivo}", d(-80), leida=True)

        # ============================================================ ESCENARIOS ACTUALES

        # 1) Ana: préstamo que vence en 2 días (renovable) + reserva lista para retirar.
        ray_n.estado = E.PRESTADO
        self.prestamo(ana, ray_n, d(-13))
        self.reserva(ana, tunel, "Norte", d(-3), R.LISTA_PARA_RETIRO, ejemplar=tu_n1, asignada=d(-1))
        self.notificar(ana, N.RESERVA_LISTA, "Tu ejemplar está listo",
                       f"«{tunel.nombre}» ({tu_n1.codigo_inventario}) te espera en Sede Norte por 48 hs hábiles.",
                       d(-1))

        # 2) Bruno: préstamo VENCIDO hace 10 días, todavía sin sanción.
        self.prestamo(bruno, pp_c1, d(-25), estado=EstadoPrestamo.VENCIDO)

        # 3) Carla: devolvió tarde hace 6 días -> MULTA impaga.
        p = self.prestamo(carla, ce_c1, d(-35), devuelto=d(-6))
        dias, monto = multa_por_retraso(p.fecha_vencimiento, d(-6))
        motivo = f"Devolución tardía del préstamo {p.numero} ({dias} día(s) hábiles de retraso)"
        self.sancion(carla, p, TipoSancion.MULTA, d(-6), motivo, monto=monto)
        self.notificar(carla, N.SANCION_APLICADA, "Se te aplicó una sanción",
                       f"Multa de ${monto:.2f}. Motivo: {motivo}", d(-6))

        # 4) Diego: devolvió con daños hace 5 días -> suspendido 15 días, ejemplar en reparación.
        p = self.prestamo(diego, qu_s1, d(-20), devuelto=d(-5))
        susp = self.sancion(diego, p, TipoSancion.SUSPENSION, d(-5),
                            f"Devolvió con daños el préstamo {p.numero}",
                            fin=d(-5 + DIAS_SUSPENSION), dias=DIAS_SUSPENSION)
        self.notificar(diego, N.SANCION_APLICADA, "Se te aplicó una sanción",
                       f"Suspensión de {DIAS_SUSPENSION} día(s) hasta el {susp.fecha_fin:%d/%m/%Y}. "
                       f"Motivo: {susp.motivo}", d(-5))

        # 5) Elena: vencido hace más de 2 meses -> candidato a "marcar perdido".
        self.prestamo(elena, mf_n1, d(-80), estado=EstadoPrestamo.VENCIDO)

        # 6) Federico: ya dado por perdido -> BAJA + sanción REPOSICION.
        p = self.prestamo(
            federico, pr_c1, d(-100), estado=EstadoPrestamo.VENCIDO,
            observaciones=f"Nunca fue devuelto: ejemplar dado por perdido el {d(-20):%d/%m/%Y}.",
        )
        federico.estado = EstadoSocio.BAJA
        motivo = f"No devolvió el ejemplar {pr_c1.codigo_inventario} del préstamo {p.numero}"
        self.sancion(federico, p, TipoSancion.REPOSICION, d(-20), motivo)
        self.notificar(federico, N.SANCION_APLICADA, "Se te aplicó una sanción",
                       "Quedaste dado de baja como socio. Para volver a asociarte tenés que reponer una "
                       f"copia del libro, de una edición igual o posterior. Motivo: {motivo}", d(-20))

        # 7) Pedro Páramo, libro "caliente": todos los ejemplares ocupados y cola de espera.
        #    - Gabriela tenía PP-C2 listo pero se le venció la ventana ayer.
        #    - Hernán (Centro) e Inés (Norte) esperan: al procesar vencimientos lo hereda Hernán.
        #    - Julián tiene PP-S1 y no puede renovar porque hay cola.
        self.reserva(gabriela, pedro, "Centro", d(-8), R.LISTA_PARA_RETIRO, ejemplar=pp_c2,
                     asignada=d(-3), vence_retiro=d(-1))
        self.notificar(gabriela, N.RESERVA_LISTA, "Tu ejemplar está listo",
                       f"«{pedro.nombre}» ({pp_c2.codigo_inventario}) te espera en Sede Centro por 48 hs hábiles.",
                       d(-3), leida=True)
        self.reserva(hernan, pedro, "Centro", d(-5), R.PENDIENTE)
        self.reserva(ines, pedro, "Norte", d(-4), R.PENDIENTE)
        self.prestamo(julian, pp_s1, d(-9))

        # 8) Karina: El túnel viaja Centro -> Sur (remito despachado ayer, falta recibir).
        self.reserva(karina, tunel, "Sur", d(-2), R.EN_TRANSITO, ejemplar=tu_c1)
        self.remito("Centro", "Sur", [tu_c1], EstadoRemito.EN_TRANSITO, creado=d(-2), despachado=d(-1))
        self.notificar(karina, N.EJEMPLAR_ASIGNADO, "Te asignamos un ejemplar",
                       f"«{tunel.nombre}» viaja hacia Sede Sur; te avisaremos cuando puedas retirarlo.", d(-1))

        # 9) Lucas: La casa de los espíritus Sur -> Norte, remito creado y pendiente de despacho.
        self.reserva(lucas, casa, "Norte", d(-1), R.PENDIENTE, ejemplar=ce_s1)
        self.remito("Sur", "Norte", [ce_s1], EstadoRemito.CREADO, creado=d(-1))

        s.flush()


def _reset() -> None:
    from app import seeds

    Base.metadata.drop_all(engine)
    seeds.main()


def main() -> None:
    if "--reset" in sys.argv:
        _reset()

    with SessionLocal() as session:
        if session.scalar(select(Usuario).where(Usuario.nombre_usuario == "bruno")) is not None:
            print("La demo ya está cargada (existe el usuario 'bruno'). Usá --reset para recargarla con fechas de hoy.")
            return
        Demo(session).cargar()
        session.commit()

    print(f"Datos de demo cargados (fechas relativas a {HOY:%d/%m/%Y}).")
    print("  Personal: bibliotecario2 (Norte), bibliotecario3 (Sur) / biblio123")
    print("  Socios:   socio1, bruno, carla, diego, elena, federico, gabriela, hernan, ines,")
    print("            julian, karina, lucas / socio123 (socio1 mantiene su clave de app.seeds)")


if __name__ == "__main__":
    main()
