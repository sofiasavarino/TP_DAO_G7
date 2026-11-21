"""Envío de mails simples (SMTP) + plantillas de texto plano.

`EMAIL_BACKEND=console` (dev) solo imprime el mail por stdout; cualquier otro valor
intenta enviarlo por SMTP con los datos de `backend/.env` (`SMTP_HOST/PORT/USER/PASSWORD`).
Las plantillas viven en `backend/templates/mails/` y se renderizan con `str.format`.
"""

from email.mime.text import MIMEText
import smtplib
from pathlib import Path

from app.config.settings import (
    EMAIL_BACKEND,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USER,
)

TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates" / "mails"


def renderizar_mail(nombre_template: str, **contexto) -> str:
    """Rellena una plantilla de texto plano con `str.format(**contexto)`."""
    texto = (TEMPLATES_DIR / nombre_template).read_text(encoding="utf-8")
    return texto.format(**contexto)


def enviar_mail(destinatario: str, asunto: str, cuerpo: str) -> None:
    """Manda un mail de texto plano.

    Con `EMAIL_BACKEND=console` solo imprime (no requiere SMTP). Con cualquier otro
    valor usa SMTP real (STARTTLS + login).
    """
    if EMAIL_BACKEND == "console":
        print(f"[EMAIL:console] Para: {destinatario}\nAsunto: {asunto}\n{cuerpo}")
        return

    mensaje = MIMEText(cuerpo, "plain", "utf-8")
    mensaje["Subject"] = asunto
    mensaje["From"] = SMTP_USER
    mensaje["To"] = destinatario
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, [destinatario], mensaje.as_string())
