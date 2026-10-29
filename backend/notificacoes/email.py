# notificacoes/emails.py
from __future__ import annotations

import io
import logging
from pathlib import Path
from typing import Union

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from email.mime.image import MIMEImage
from PIL import Image, ImageDraw, ImageFilter  # requer pillow

logger = logging.getLogger(__name__)

PRIMARY = "#021D40"   # navy
ACCENT  = "#F26A1B"   # laranja


def _attach_image(
        msg: EmailMultiAlternatives,
        path_or_bytes: Union[Path, bytes, bytearray],
        cid: str,
        filename: str | None = None,
) -> bool:
    """
    Anexa uma imagem inline ao e-mail com Content-ID (cid).
    Aceita Path ou bytes.
    """
    try:
        if isinstance(path_or_bytes, (bytes, bytearray)):
            img = MIMEImage(path_or_bytes)
            if filename is None:
                filename = "image.png"
        else:
            with open(path_or_bytes, "rb") as f:
                data = f.read()
            img = MIMEImage(data)
            if filename is None:
                filename = Path(path_or_bytes).name

        img.add_header("Content-ID", f"<{cid}>")
        img.add_header("Content-Disposition", "inline", filename=filename)
        msg.attach(img)
        return True
    except Exception as e:
        logger.warning("Imagem não anexada (%s): %s", cid, e)
        return False


def _make_shadow_png(
        width: int = 552,
        height: int = 28,
        blur: int = 22,
        radius: int = 14,
        rgb: tuple[int, int, int] = (2, 29, 64),
        alpha: int = 64,
) -> bytes:
    """
    Gera um PNG (RGBA) de sombra difusa para posicionar logo abaixo do banner.
    Funciona em todos os clientes porque é imagem (não CSS).
    """
    pad = blur * 2
    W, H = width + pad, height + pad
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # retângulo arredondado que será borrado
    x0, y0, x1, y1 = blur, blur, blur + width, blur + height
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=(*rgb, alpha))

    img = img.filter(ImageFilter.GaussianBlur(blur))

    # recorta ao tamanho desejado (remove o "pad")
    left = (W - width) // 2
    top = (H - height) // 2
    img = img.crop((left, top, left + width, top + height))

    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()


def enviar_email_boas_vindas(
        nome: str,
        email_destino: str,
        senha: str | None = None,                # ideal: evitar senha em texto; mantido por compat.
        link_acesso: str | None = None,          # ex.: https://app.seudominio.com/login
        logo_path: str | None = None,            # caminho absoluto opcional
        banner_path: str | None = None,          # caminho absoluto opcional
):
    """
    Envia e-mail de boas-vindas com HTML estilizado, logo, banner e sombra do banner (inline).
    Sem link de redefinição de senha.
    """

    # Link padrão do painel (caso não seja informado)
    if not link_acesso:
        link_acesso = settings.FRONTEND_URL

    logo_path = Path(logo_path) if logo_path else None
    banner_path = Path(banner_path) if banner_path else None

    ctx = {
        "nome": nome,
        "email_destino": email_destino,
        "senha": senha,
        "link_acesso": link_acesso,
        "ano": timezone.now().year,
        "PRIMARY": PRIMARY,
        "ACCENT": ACCENT,
        "has_logo": bool(logo_path and logo_path.exists()),
        "has_banner": banner_path.exists(),
        "has_banner_shadow": True,  # controlado abaixo se falhar
    }

    html = render_to_string("notificacoes/boas_vindas.html", ctx)
    texto = render_to_string("notificacoes/boas_vindas.txt", ctx)

    msg = EmailMultiAlternatives(
        subject="Bem-vindo(a) à nossa plataforma Professor!",
        body=texto,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[email_destino],
    )
    msg.attach_alternative(html, "text/html")

    # Anexos inline
    if logo_path and logo_path.exists():
        _attach_image(msg, logo_path, cid="logo", filename=logo_path.name)
    else:
        ctx["has_logo"] = False

    if banner_path and banner_path.exists():
        _attach_image(msg, banner_path, cid="hero", filename=banner_path.name)
    else:
        ctx["has_banner"] = False

    # Sombra do banner: gera PNG e anexa (CID heroShadow)
    try:
        # 552px: largura do conteúdo interno (600px do card - 48px de padding)
        shadow_png = _make_shadow_png(width=552, height=28, blur=22, radius=14,
                                      rgb=(2, 29, 64), alpha=64)
        _attach_image(msg, shadow_png, cid="heroShadow", filename="banner-shadow.png")
    except Exception as e:
        logger.warning("Falha ao gerar sombra do banner: %s", e)
        ctx["has_banner_shadow"] = False

    msg.send()
    logger.info("E-mail de boas-vindas enviado para %s", email_destino)
