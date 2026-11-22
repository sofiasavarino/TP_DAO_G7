from datetime import date, timedelta


def dias_habiles_entre(desde: date, hasta: date) -> int:
    """Días laborables entre dos fechas (lun–vie), sin contar el propio `hasta` si no ha pasado.

    Si `hasta <= desde` devuelve 0 (sin retraso).
    """
    if hasta <= desde:
        return 0
    dias = 0
    actual = desde
    while actual < hasta:
        actual += timedelta(days=1)
        if actual.weekday() < 5:
            dias += 1
    return dias


def sumar_dias_habiles(desde: date, dias: int) -> date:
    """Suma `dias` días hábiles (lun–vie) a `desde`."""
    restantes = dias
    actual = desde
    while restantes:
        actual += timedelta(days=1)
        if actual.weekday() < 5:
            restantes -= 1
    return actual
