"""business_social_scraper.py — Scraper gratuito con IA para redes sociales y webs de negocios.

Recorre las URLs públicas de un negocio (webUrl, instagramUrl, facebookUrl, twitterUrl),
obtiene contenido mediante métodos 100% gratuitos (httpx + BeautifulSoup, Jina Reader y
búsqueda indexada DuckDuckGo) y extrae eventos/ofertas estructurados usando el router
de modelos IA gratuitos (NVIDIA NIM, OpenRouter Free, Google Gemini Flash/Flash-Lite).
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import unicodedata
from datetime import datetime, timedelta
from typing import Any, Callable, Optional
from urllib.parse import parse_qsl, quote_plus, unquote, urlencode, urljoin, urlparse, urlunparse
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup
from pydantic import BaseModel, Field, ValidationError

try:
    from ddgs import DDGS
except ImportError:  # pragma: no cover
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        DDGS = None

log = logging.getLogger("business_social_scraper")

ZONA_MADRID = ZoneInfo("Europe/Madrid")
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
}

# Palabras clave expandidas para detectar enlaces relevantes en webs y búsquedas.
# Cubren: eventos, ofertas, promociones, hostelería, turismo, comercio, cultura, deportes.
PALABRAS_SUBENLACE = (
    # Eventos / agenda
    "evento", "eventos", "agenda", "calendario", "programacion", "programación",
    "fiesta", "fiestas", "feria", "romeria", "romería", "festival", "concierto",
    "espectaculo", "espectáculo", "actuacion", "actuación", "verbena",
    # Ofertas / promociones / comercio
    "oferta", "ofertas", "promo", "promocion", "promoción", "descuento", "descuentos",
    "rebaja", "rebajas", "oferta_especial", "ofertaespecial", "promociones",
    "pack", "paquete", "packs", "paquetes", "2x1", "3x2",
    # Hostelería / gastronomía
    "menu", "menú", "carta", "degustacion", "degustación", "cata", "maridaje",
    "especialidad", "especialidades", "recomendacion", "recomendación", "plato",
    "almuerzo", "cena", "desayuno", "brunch", "tapeo", "tapas", "pinchos",
    # Turismo / experiencias
    "turismo", "viaje", "viajes", "excursion", "excursión", "ruta", "rutas",
    "senderismo", "visita", "visitas", "tour", "guia", "guía", "experiencia",
    "escapada", "escapadas", "estancia", "alojamiento", "hotel", "casa_rural",
    # Actividades / talleres / deportes
    "actividad", "actividades", "taller", "talleres", "curso", "cursos",
    "clase", "clases", "entrenamiento", "campus", "campamento",
    "deporte", "deportes", "carrera", "marcha", "trail", "btt", "ciclismo",
    # Comunicación / llamada a la acción
    "apuntate", "apúntate", "inscripciones", "inscripcion", "inscripción",
    "plazas", "plaza", "reserva", "reservas", "reservar", "booking",
    "compra", "comprar", "entrada", "entradas", "ticket", "tickets",
    # Temporalidad / urgencia
    "novedad", "novedades", "nuevo", "nueva", "lanzamiento", "estreno",
    "especial", "especiales", "destacado", "destacados", "recomendado",
    "este_fin_semana", "este_fin_de_semana", "fin_semana", "fin_de_semana",
    "este_sabado", "este_sábado", "este_domingo", "manana", "mañana",
    "proximo", "próximo", "proxima", "próxima", "proximos", "próximos",
    "puente", "festivo", "vacaciones", "verano", "navidad", "semana_santa",
    # General
    "actualidad", "noticias", "blog", "promociones", "ofertas",
)

PARAMS_TRACKING = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "igshid", "igsh", "ref", "s", "t", "si",
}

CATEGORIAS_VALIDAS = {
    1: "Turismo",
    2: "Fiesta Patronal",
    3: "Gastronomía",
    4: "Comercio",
    5: "Deportes",
    6: "Cultura",
}

# Solo se analizan las N publicaciones más recientes de cada red social.
MAX_POSTS_POR_RED = int(os.environ.get("MAX_POSTS_POR_RED", "3") or 3)


class EventoDetectado(BaseModel):
    nombre: str = Field(..., min_length=3, max_length=160)
    descripcion: str = Field(default="")
    tipoEvento: int = Field(default=4, ge=1, le=6)
    fechaInicio: str = Field(..., description="ISO 8601 YYYY-MM-DDTHH:MM:SS+01:00 o YYYY-MM-DD")
    fechaFin: Optional[str] = Field(default=None)
    dePago: bool = Field(default=False)
    aforo: int = Field(default=40, ge=0, le=5000)
    imagen: str = Field(default="")
    urlPost: str = Field(default="")
    redSocial: str = Field(default="Web")


class LoteEventosNegocio(BaseModel):
    eventos: list[EventoDetectado] = Field(default_factory=list)


def normalizar_texto(texto: str) -> str:
    s = unicodedata.normalize("NFD", str(texto or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9\s]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def normalizar_url(url: str) -> str:
    raw = str(url or "").strip()
    if not raw:
        return ""
    if not re.match(r"^https?://", raw, re.IGNORECASE) and not raw.startswith("social://"):
        raw = f"https://{raw}"
    try:
        parsed = urlparse(raw)
        if parsed.scheme == "social":
            return raw.rstrip("/")
        netloc = parsed.netloc.lower()
        if netloc.startswith("www."):
            netloc = netloc[4:]
        # Normalizar http -> https para las fuentes web/rrss (evita duplicados por esquema)
        scheme = parsed.scheme.lower()
        if scheme == "http" and netloc and "localhost" not in netloc and "127.0.0.1" not in netloc:
            scheme = "https"
        query_filtrada = [
            (k, v)
            for k, v in parse_qsl(parsed.query, keep_blank_values=False)
            if k.lower() not in PARAMS_TRACKING
        ]
        path = re.sub(r"/+$", "", parsed.path)
        return urlunparse((
            scheme,
            netloc,
            path,
            "",
            urlencode(query_filtrada),
            "",
        ))
    except Exception:
        return raw.rstrip("/")


def construir_huella(negocio_id: int | str, titulo: str, fecha_iso: str) -> str:
    fecha_dia = str(fecha_iso or "")[:10]
    return f"{negocio_id}|{normalizar_texto(titulo)}|{fecha_dia}"


def generar_url_sintetica(negocio_id: int | str, red_social: str, titulo: str, fecha_iso: str) -> str:
    red_slug = re.sub(r"[^a-z0-9]+", "", normalizar_texto(red_social)) or "web"
    base = f"{negocio_id}|{red_slug}|{normalizar_texto(titulo)}|{str(fecha_iso or '')[:10]}"
    digest = hashlib.sha256(base.encode("utf-8")).hexdigest()[:12]
    return f"social://{negocio_id}/{red_slug}/{digest}"


def extraer_handle_rrss(url: str, red: str) -> str:
    try:
        parsed = urlparse(normalizar_url(url))
        segmentos = [s for s in parsed.path.split("/") if s]
        if not segmentos:
            return ""
        primero = segmentos[0]
        if red == "Facebook" and primero.lower() == "profile.php":
            qs = dict(parse_qsl(parsed.query))
            return qs.get("id", "")
        if primero.lower() in ("p", "reel", "stories", "explore", "share", "hashtag"):
            return ""
        return primero.lstrip("@")
    except Exception:
        return ""


# Segmentos de ruta que indican que la URL es un post/publicación concreta (no el perfil)
SEGMENTOS_POST = {
    "p", "reel", "reels", "posts", "photos", "videos", "status", "watch",
    "events", "share", "permalink", "story", "stories",
}


def es_url_post_real(url_candidata: str, url_perfil: str) -> bool:
    """Indica si url_candidata es un post/publicación concreta (no el perfil ni una URL genérica).

    Sirve para evitar que la IA meta la URL genérica del perfil/red social como `urlPost`
    del evento, lo que provocaba que los escaneos posteriores marcaran todo como duplicado
    y no se encontraran eventos nuevos.
    """
    nc = normalizar_url(url_candidata)
    np_ = normalizar_url(url_perfil)
    if not nc:
        return False
    if nc.startswith("social://"):
        return False
    if nc == np_:
        return False
    pc = urlparse(nc)
    pp = urlparse(np_)
    # Host distinto => enlace externo (noticia, evento, web) => es un post/enlace real
    if pc.netloc and pp.netloc and pc.netloc != pp.netloc:
        return True
    segs_c = [s for s in pc.path.split("/") if s]
    segs_p = [s for s in pp.path.split("/") if s]
    # Si algún segmento es un indicador claro de publicación => post real
    if any(s.lower() in SEGMENTOS_POST for s in segs_c):
        return True
    # Más segmentos que el perfil => publicación concreta
    if len(segs_c) > len(segs_p) and len(segs_c) >= 2:
        return True
    return False


def _descargar_html(url: str, timeout: float = 12.0) -> str:
    for verify in (True, False):
        try:
            r = requests.get(
                url, headers=HEADERS, allow_redirects=True, timeout=timeout, verify=verify
            )
            if r.status_code >= 400:
                return ""
            return r.text
        except requests.exceptions.SSLError:
            continue
        except Exception as exc:
            log.debug("Error descargando %s: %s", url, exc)
            return ""
    return ""


def _es_muro_de_login(texto: str) -> bool:
    """Detecta pantallas de login / captcha / contenido no disponible.

    Instagram y Facebook devuelven una página de login cuando no hay sesión. Antes
    se enviaba ese texto a la IA como si fuera contenido del negocio, por lo que
    nunca se encontraban eventos.
    """
    t = str(texto or "")[:5000].lower()
    marcadores = (
        "accounts/login",
        "login/?next",
        "log into facebook",
        "logged in on your phone",
        "scan the qr code",
        "see everyday moments from your close friends",
        "inicia sesion",
        "iniciar sesion",
        "contenido no disponible",
        "this content isn't available",
        "this page isn't available",
        "performing security verification",
        "just a moment...",
        "please complete the following challenge",
        "complete the following challenge",
    )
    return any(m in t for m in marcadores)


def _leer_con_jina(url: str, max_chars: int = 7000) -> str:
    try:
        jina_url = f"https://r.jina.ai/{url}"
        r = requests.get(
            jina_url,
            headers={"User-Agent": HEADERS["User-Agent"], "Accept": "text/plain"},
            allow_redirects=True,
            timeout=20.0,
        )
        if r.status_code == 200 and r.text:
            texto = r.text.strip()
            if _es_muro_de_login(texto):
                return ""
            # Jina añade una cabecera (Title/URL Source/Markdown Content). Medimos
            # el contenido real para no aceptar páginas vacías.
            cuerpo = texto.split("Markdown Content:", 1)[-1].strip()
            if len(cuerpo) > 120:
                return texto[:max_chars]
    except Exception as exc:
        log.debug("Jina Reader falló para %s: %s", url, exc)
    return ""


def _limpiar_html(html: str, base_url: str, max_chars: int = 7500) -> tuple[str, list[str], str]:
    """Devuelve (texto_limpio_con_jsonld, subenlaces_relevantes, og_image)."""
    if not html:
        return "", [], ""
    soup = BeautifulSoup(html, "html.parser")
    metas: list[str] = []
    og_image = ""

    for prop in ("og:title", "og:description", "description"):
        tag = soup.find("meta", attrs={"property": prop}) or soup.find("meta", attrs={"name": prop})
        if tag and tag.get("content"):
            metas.append(str(tag["content"]).strip())

    img_tag = soup.find("meta", attrs={"property": "og:image"})
    if img_tag and img_tag.get("content"):
        og_image = urljoin(base_url, str(img_tag["content"]).strip())

    # Extraer JSON-LD si contiene Event / Offer
    jsonld_bloques: list[str] = []
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = (script.string or "").strip()
        if raw and any(k in raw.lower() for k in ("event", "offer", "startdate")):
            jsonld_bloques.append(raw[:2000])

    # Detectar subenlaces relevantes en el mismo dominio
    dominio_base = urlparse(base_url).netloc.lower()
    subenlaces: list[str] = []
    for a in soup.find_all("a", href=True):
        href = urljoin(base_url, a["href"])
        parsed = urlparse(href)
        if parsed.netloc.lower() != dominio_base:
            continue
        ruta_y_texto = f"{parsed.path} {a.get_text(' ', strip=True)}".lower()
        if any(p in ruta_y_texto for p in PALABRAS_SUBENLACE):
            norm = normalizar_url(href)
            if norm and norm != normalizar_url(base_url) and norm not in subenlaces:
                subenlaces.append(norm)
        if len(subenlaces) >= 2:
            break

    for ruido in soup(["script", "style", "nav", "footer", "noscript", "svg"]):
        ruido.decompose()

    lineas = [l.strip() for l in soup.get_text(separator="\n").splitlines()]
    cuerpo = "\n".join(l for l in lineas if len(l) > 2)
    partes = []
    if metas:
        partes.append("METADATOS:\n" + "\n".join(dict.fromkeys(metas)))
    if jsonld_bloques:
        partes.append("DATOS ESTRUCTURADOS JSON-LD:\n" + "\n".join(jsonld_bloques))
    if cuerpo:
        partes.append(cuerpo)

    return "\n\n".join(partes).strip()[:max_chars], subenlaces, og_image


_AVISO_DDGS_MOSTRADO = False


def _buscar_ddg(queries: list[str], max_results: int = 5) -> list[dict[str, str]]:
    global _AVISO_DDGS_MOSTRADO
    if DDGS is None:
        if not _AVISO_DDGS_MOSTRADO:
            log.warning("ddgs no está instalado; se usará el fallback vía Jina Reader.")
            _AVISO_DDGS_MOSTRADO = True
        return []
    resultados: list[dict[str, str]] = []
    vistos: set[str] = set()
    try:
        with DDGS() as ddgs:
            for q in queries:
                try:
                    for item in ddgs.text(q, region="es-es", max_results=max_results):
                        href = normalizar_url(item.get("href", ""))
                        if not href or href in vistos:
                            continue
                        vistos.add(href)
                        resultados.append({
                            "url": href,
                            "titulo": str(item.get("title", "")).strip(),
                            "resumen": str(item.get("body", "")).strip(),
                        })
                except Exception as exc:
                    log.debug("Aviso DDGS '%s': %s", q, exc)
    except Exception as exc:
        log.debug("DDGS no disponible: %s", exc)
    return resultados


def _resolver_enlace_ddg(url: str) -> str:
    """Resuelve los enlaces de redirección de DuckDuckGo (uddg=...)."""
    raw = str(url or "").strip()
    if "uddg=" in raw:
        try:
            qs = parse_qs(urlparse(raw).query)
            destino = (qs.get("uddg") or [""])[0]
            if destino:
                return normalizar_url(unquote(destino))
        except Exception:
            pass
    return normalizar_url(raw)


def _buscar_ddg_via_jina(
    queries: list[str], max_results: int = 5
) -> list[dict[str, str]]:
    """Fallback de búsqueda usando Jina Reader sobre la versión HTML de DuckDuckGo.

    En servidores (Render, etc.) la librería `ddgs` a veces recibe bloqueos. Jina
    lee la página desde otra IP y devuelve los resultados en Markdown.
    """
    resultados: list[dict[str, str]] = []
    vistos: set[str] = set()
    for q in queries:
        target = "https://html.duckduckgo.com/html/?q=" + quote_plus(q)
        try:
            r = requests.get(
                f"https://r.jina.ai/{target}",
                headers={"User-Agent": HEADERS["User-Agent"], "Accept": "text/plain"},
                timeout=25.0,
            )
            if r.status_code != 200 or not r.text or _es_muro_de_login(r.text):
                continue
            # Jina devuelve Markdown. Buscamos enlaces en varios formatos:
            # - ## [Título](URL)  (headers)
            # - * [Título](URL)   (lista)
            # - [Título](URL)     (en línea)
            for linea in r.text.splitlines():
                # Patrón flexible para enlaces markdown
                m = re.search(r"\[([^\]]+)\]\((https?://[^)]+)\)", linea)
                if not m:
                    continue
                titulo = m.group(1).strip()
                url_raw = m.group(2)
                # Saltar enlaces de navegación de DDG (All, Images, Videos, News, etc.)
                if titulo.lower() in ("all", "images", "videos", "news", "maps", "shopping", "search assist", "ask duck.ai"):
                    continue
                url_real = _resolver_enlace_ddg(url_raw)
                if not url_real or url_real in vistos:
                    continue
                # Solo aceptamos URLs del dominio objetivo (instagram.com, facebook.com, etc.)
                # No enlaces de duckduckgo.com u otros buscadores
                parsed = urlparse(url_real)
                if "duckduckgo.com" in parsed.netloc:
                    continue
                # Extraer resumen del resto de la línea
                resto = linea[m.end():]
                resto = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", resto)
                resto = re.sub(r"\[[^\]]*\]\([^)]*\)", " ", resto)
                resumen = re.sub(r"\s+", " ", resto).strip()
                vistos.add(url_real)
                resultados.append({
                    "url": url_real,
                    "titulo": titulo,
                    "resumen": resumen,
                })
                if len(resultados) >= max_results:
                    return resultados
        except Exception as exc:
            log.debug("Fallback Jina/DDG falló para '%s': %s", q, exc)
    return resultados


def _buscar_posts_red(
    queries: list[str],
    url_perfil: str = "",
    limite: int = MAX_POSTS_POR_RED,
) -> list[dict[str, str]]:
    """Devuelve como máximo `limite` publicaciones únicas (sin repetir URL ni texto).

    Se descartan la URL del perfil y enlaces genéricos: solo cuentan publicaciones
    concretas. Si DuckDuckGo no responde, se intenta el fallback vía Jina.
    """
    if not queries or limite <= 0:
        return []
    posts: list[dict[str, str]] = []
    urls_vistas: set[str] = set()
    textos_vistos: set[str] = set()
    # Pedimos de más por si DDG devuelve repetidos entre consultas.
    candidatos = _buscar_ddg(queries, max_results=max(limite * 3, limite))
    if not candidatos:
        candidatos = _buscar_ddg_via_jina(queries, max_results=max(limite * 3, limite))
    for r in candidatos:
        url_post = normalizar_url(r.get("url", ""))
        if not url_post or url_post in urls_vistas:
            continue
        if url_perfil and not es_url_post_real(url_post, url_perfil):
            continue
        texto_post = normalizar_texto(f"{r.get('titulo', '')} {r.get('resumen', '')}")
        if texto_post and texto_post in textos_vistos:
            continue
        urls_vistas.add(url_post)
        if texto_post:
            textos_vistos.add(texto_post)
        posts.append(r)
        if len(posts) >= limite:
            break
    return posts


def _instagram_posts_publicos(
    url_perfil: str, limite: int = MAX_POSTS_POR_RED
) -> list[dict[str, str]]:
    """Últimas publicaciones de Instagram usando el endpoint público del perfil.

    No requiere login. Si Instagram limita la IP (HTTP 429), devuelve [] y se
    probará la búsqueda indexada como respaldo.
    """
    usuario = extraer_handle_rrss(url_perfil, "Instagram")
    if not usuario:
        return []
    try:
        r = requests.get(
            "https://www.instagram.com/api/v1/users/web_profile_info/",
            params={"username": usuario},
            headers={
                **HEADERS,
                "x-ig-app-id": "936619743392459",
                "x-requested-with": "XMLHttpRequest",
                "Accept": "*/*",
                "Referer": f"https://www.instagram.com/{usuario}/",
            },
            timeout=15.0,
        )
        if r.status_code != 200 or not r.text:
            log.debug("Instagram API devolvió HTTP %s para @%s", r.status_code, usuario)
            return []
        data = r.json()
        user = (data.get("data") or {}).get("user") or {}
        edges = ((user.get("edge_owner_to_timeline_media") or {}).get("edges")) or []
        posts: list[dict[str, str]] = []
        for edge in edges:
            nodo = edge.get("node") or {}
            shortcode = str(nodo.get("shortcode") or "").strip()
            if not shortcode:
                continue
            caption = ""
            caps = ((nodo.get("edge_media_to_caption") or {}).get("edges")) or []
            if caps:
                caption = str(((caps[0] or {}).get("node") or {}).get("text") or "").strip()
            ts = nodo.get("taken_at_timestamp")
            fecha = ""
            if ts:
                try:
                    fecha = datetime.fromtimestamp(int(ts), tz=ZONA_MADRID).strftime("%Y-%m-%d")
                except (ValueError, OSError):
                    fecha = ""
            primera = _primera_linea_significativa(caption)
            posts.append({
                "url": f"https://www.instagram.com/p/{shortcode}/",
                "titulo": (primera or f"Publicación de Instagram {fecha}")[:140],
                "resumen": caption[:1500],
                "fecha": fecha,
                "imagen": str(nodo.get("display_url") or ""),
            })
            if len(posts) >= limite:
                break
        return posts
    except Exception as exc:
        log.debug("Instagram API no disponible para @%s: %s", usuario, exc)
        return []


def _instagram_posts_via_jina(url_perfil: str, limite: int = MAX_POSTS_POR_RED) -> list[dict[str, str]]:
    """Fallback: usa Jina Reader para leer los posts indexados de Instagram.

    Cuando la API pública falla (rate limit), Jina puede leer la versión HTML
    de los resultados de búsqueda o páginas de posts concretos.
    """
    usuario = extraer_handle_rrss(url_perfil, "Instagram")
    if not usuario:
        return []
    posts: list[dict[str, str]] = []
    urls_vistas: set[str] = set()
    # Buscamos en DuckDuckGo vía Jina para obtener URLs de posts concretos
    queries = [
        f'site:instagram.com/p/ "{usuario}"',
        f'site:instagram.com/reel/ "{usuario}"',
    ]
    candidatos = _buscar_ddg_via_jina(queries, max_results=limite * 2)
    for r in candidatos:
        url_post = normalizar_url(r.get("url", ""))
        if not url_post or url_post in urls_vistas:
            continue
        if not es_url_post_real(url_post, url_perfil):
            continue
        urls_vistas.add(url_post)
        # Leemos el post individual con Jina para obtener el contenido completo
        jina = _leer_con_jina(url_post, max_chars=5000)
        if not jina or _es_muro_de_login(jina):
            # Si Jina falla, usamos lo que trajo el buscador
            posts.append({
                "url": url_post,
                "titulo": _primera_linea_significativa(r.get("titulo", "")) or f"Post Instagram {usuario}",
                "resumen": r.get("resumen", ""),
                "fecha": "",
                "imagen": "",
            })
        else:
            # Extraer primera línea significativa del contenido Jina
            cuerpo = jina.split("Markdown Content:", 1)[-1].strip()
            primera = _primera_linea_significativa(cuerpo)
            posts.append({
                "url": url_post,
                "titulo": (primera or r.get("titulo") or f"Post Instagram {usuario}")[:140],
                "resumen": cuerpo[:1500],
                "fecha": "",
                "imagen": "",
            })
        if len(posts) >= limite:
            break
    return posts


def _es_linea_solo_tags(l: str) -> bool:
    """True si la línea solo contiene hashtags, menciones, emojis y espacios."""
    tokens = l.strip().split()
    if not tokens:
        return True
    for t in tokens:
        # Si el token empieza por # o @, es tag/mención
        if t.startswith("#") or t.startswith("@"):
            continue
        # Si es solo emojis (rango Unicode amplio)
        if re.match(r"^[\U0001F300-\U0001FAFF]+$", t):
            continue
        # Si tiene letras/números reales, NO es línea de solo tags
        if re.search(r"[A-Za-z0-9]", t):
            return False
    return True


def _primera_linea_significativa(texto: str) -> str:
    """Devuelve la primera línea que no sea solo hashtags/emojis ni vacía."""
    for l in (texto or "").splitlines():
        l = l.strip()
        if not l:
            continue
        if _es_linea_solo_tags(l):
            continue
        return l
    return ""


def _posts_plugin_facebook(
    url_perfil: str, limite: int = MAX_POSTS_POR_RED
) -> list[dict[str, str]]:
    """Últimas publicaciones de una página de Facebook con el plugin público.

    El plugin oficial de página devuelve un JSON con `timelinePosts` (mensaje,
    fecha y foto) sin necesidad de login ni API key. Es mucho más fiable que
    intentar descargar facebook.com, que responde con un muro de login.
    """
    try:
        r = requests.get(
            "https://www.facebook.com/plugins/page.php",
            params={
                "href": url_perfil,
                "tabs": "timeline",
                "width": 500,
                "height": 1200,
                "small_header": "true",
                "adapt_container_width": "true",
                "hide_cover": "false",
                "show_facepile": "false",
            },
            headers=HEADERS,
            timeout=15.0,
        )
        if r.status_code != 200 or "timelinePosts" not in r.text:
            log.debug("Plugin de Facebook sin timelinePosts (HTTP %s)", r.status_code)
            return []
        m = re.search(r'"timelinePosts"\s*:\s*', r.text)
        if not m:
            return []
        arr, _ = json.JSONDecoder().raw_decode(r.text[m.end():])
        if not isinstance(arr, list):
            return []
        posts: list[dict[str, str]] = []
        for item in arr:
            if not isinstance(item, dict):
                continue
            mensaje = str(item.get("message") or "").strip()
            if not mensaje:
                continue
            ts = item.get("createdTime")
            fecha = ""
            if ts:
                try:
                    fecha = datetime.fromtimestamp(int(ts), tz=ZONA_MADRID).strftime("%Y-%m-%d")
                except (ValueError, OSError):
                    fecha = ""
            primera = _primera_linea_significativa(mensaje)
            digest = hashlib.sha256(f"{ts}|{mensaje[:120]}".encode("utf-8")).hexdigest()[:12]
            posts.append({
                # URL sintética única por publicación: el plugin no expone el permalink.
                "url": f"social://facebook/{digest}",
                "titulo": (primera or f"Publicación de Facebook {fecha}")[:140],
                "resumen": mensaje[:1500],
                "fecha": fecha,
                "imagen": str(item.get("photoURL") or ""),
            })
        posts.sort(key=lambda p: p.get("fecha") or "", reverse=True)
        return posts[:max(1, limite)]
    except Exception as exc:
        log.debug("Plugin de Facebook no disponible: %s", exc)
        return []


def recolectar_contenido_fuente(
    url: str, red_social: str, nombre_negocio: str, pueblo: str
) -> dict[str, Any]:
    """Recoge texto público de una URL (Web, Instagram, Facebook o Twitter/X) de forma gratuita."""
    url_norm = normalizar_url(url)
    bloques: list[str] = []
    og_image = ""
    posts: list[dict[str, str]] = []

    if red_social == "Web":
        html = _descargar_html(url_norm)
        texto, subenlaces, og_image = _limpiar_html(html, url_norm)
        if texto:
            bloques.append(f"=== WEB PRINCIPAL ({url_norm}) ===\n{texto}")
        for sub in subenlaces:
            sub_html = _descargar_html(sub)
            sub_txt, _, _ = _limpiar_html(sub_html, sub, max_chars=4000)
            if sub_txt:
                bloques.append(f"=== SUBPÁGINA ({sub}) ===\n{sub_txt}")
        if not bloques:
            jina = _leer_con_jina(url_norm)
            if jina:
                bloques.append(f"=== WEB VIA JINA ({url_norm}) ===\n{jina}")
    else:
        # Perfil público de red social: solo las N publicaciones más recientes (sin repetidas).
        handle = extraer_handle_rrss(url_norm, red_social)
        dominio = {
            "Instagram": "instagram.com",
            "Facebook": "facebook.com",
            "Twitter/X": "x.com",
        }.get(red_social, "")

        # 1) Fuentes directas y fiables (sin login):
        #    - Facebook: plugin público de página (JSON con los últimos posts).
        #    - Instagram: endpoint público del perfil (si no limita la IP).
        if red_social == "Facebook":
            posts = _posts_plugin_facebook(url_norm, MAX_POSTS_POR_RED)
        elif red_social == "Instagram":
            posts = _instagram_posts_publicos(url_norm, MAX_POSTS_POR_RED)
            # Si la API falla (rate limit 429), NO usamos búsqueda indexada porque
            # devuelve basura (páginas de redirect de DDG). Mejor omitir Instagram
            # y confiar en Facebook/Web que sí funcionan.

        # 2) Búsqueda indexada como respaldo (DuckDuckGo o Jina si DDG está bloqueado).
        #    Solo para Facebook (plugin ya cubierto) y Web.
        if not posts and red_social != "Instagram":
            queries: list[str] = []
            if dominio and handle:
                # Query amplia: eventos + ofertas + hostelería + turismo + actividades
                queries.append(
                    f'site:{dominio} "{handle}" '
                    '(oferta OR ofertas OR promo OR promocion OR promociones OR descuento OR rebaja '
                    'OR evento OR eventos OR agenda OR fiesta OR feria OR festival OR concierto '
                    'OR taller OR talleres OR curso OR actividad OR actividades '
                    'OR menu OR menú OR carta OR degustacion OR cata OR maridaje '
                    'OR viaje OR viajes OR excursion OR excursión OR ruta OR rutas OR turismo '
                    'OR experiencia OR escapada OR pack OR paquete OR 2x1 '
                    'OR novedad OR nuevo OR especial OR plazas OR reserva OR inscripciones)'
                )
                queries.append(f'site:{dominio}/{handle}')
            if dominio and nombre_negocio:
                queries.append(
                    f'site:{dominio} "{nombre_negocio}" "{pueblo}" '
                    '(oferta OR evento OR promocion OR agenda OR menu OR viaje OR excursion OR taller OR actividad OR novedad OR especial)'
                )
            posts = _buscar_posts_red(
                queries, url_perfil=url_norm, limite=MAX_POSTS_POR_RED
            )

        # Metadatos del perfil (también aportan la imagen por defecto)
        html = _descargar_html(url_norm, timeout=10.0)
        txt_meta = ""
        if html:
            txt_meta, _, og_image = _limpiar_html(html, url_norm, max_chars=3000)

        # Si el perfil no tiene og:image, usar la foto de la primera publicación.
        if not og_image:
            for p in posts:
                if p.get("imagen"):
                    og_image = str(p["imagen"])
                    break

        if txt_meta and len(txt_meta) > 80 and not _es_muro_de_login(txt_meta):
            bloques.append(f"=== PERFIL {red_social.upper()} ({url_norm}) ===\n{txt_meta}")

        if posts:
            for r in posts:
                bloques.append(
                    f"[POST {red_social}] URL: {r['url']}\n"
                    f"Publicado: {r.get('fecha') or 'desconocido'}\n"
                    f"Título: {r['titulo']}\nResumen: {r['resumen']}"
                )
        else:
            # Sin publicaciones: Jina Reader como último respaldo (filtra muros de login).
            jina = _leer_con_jina(url_norm, max_chars=5500)
            if jina:
                bloques.append(f"=== CONTENIDO PÚBLICO {red_social.upper()} ({url_norm}) ===\n{jina}")

    return {
        "redSocial": red_social,
        "urlPerfil": url_norm,
        "texto": "\n\n".join(bloques).strip(),
        "imagenDefecto": og_image,
        "posts": posts,
    }


def _invocar_llm_gratuito(system_prompt: str, user_prompt: str) -> dict[str, Any]:
    """Usa el ProductionLLMRouter (NVIDIA NIM / OpenRouter Free / Gemini) con fallback a ai_client."""
    try:
        from agents.scrapper import ProductionLLMRouter

        router = ProductionLLMRouter()
        return router.generar_json(system_prompt, user_prompt)
    except Exception as exc:
        log.warning("ProductionLLMRouter no disponible o agotado (%s). Probando fallback Gemini...", exc)

    if os.environ.get("GEMINI_API_KEY", "").strip():
        from agents.ai_client import generar_json

        return generar_json(
            prompt=f"{system_prompt}\n\n{user_prompt}",
            contenidos=[],
            esquema=LoteEventosNegocio,
        )

    raise RuntimeError(
        "No hay ninguna API key gratuita configurada (NVIDIA_API_KEY, OPENROUTER_API_KEY o GEMINI_API_KEY)."
    )


def _normalizar_fechas(fecha_ini_raw: str, fecha_fin_raw: Optional[str]) -> Optional[tuple[str, str]]:
    """Convierte fechas extraídas por el LLM a ISO 8601 válido en Europe/Madrid y descarta eventos pasados."""
    ahora = datetime.now(ZONA_MADRID)
    raw_ini = str(fecha_ini_raw or "").strip()
    if not raw_ini:
        return None

    def parse_dt(val: str, default_hour: int) -> Optional[datetime]:
        v = str(val or "").strip()
        if not v:
            return None
        v = v.replace("Z", "+00:00")
        try:
            dt_obj = datetime.fromisoformat(v)
            if dt_obj.tzinfo is None:
                dt_obj = dt_obj.replace(tzinfo=ZONA_MADRID)
            return dt_obj.astimezone(ZONA_MADRID)
        except ValueError:
            pass
        m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", v)
        if m:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), default_hour, 0, tzinfo=ZONA_MADRID)
        return None

    ini = parse_dt(raw_ini, 10)
    if not ini:
        return None

    # Descartar eventos que ya pasaron hace más de 2 días
    if ini < ahora - timedelta(days=2):
        return None

    fin = parse_dt(fecha_fin_raw, 13) if fecha_fin_raw else None
    if not fin or fin <= ini:
        fin = ini + timedelta(hours=2)

    return ini.isoformat(), fin.isoformat()


def scrapear_redes_negocio(
    negocio: dict[str, Any],
    urls_existentes: Optional[list[str]] = None,
    huellas_existentes: Optional[list[str]] = None,
    texto_manual: Optional[str] = None,
    red_manual: Optional[str] = None,
    url_post_manual: Optional[str] = None,
    on_progress: Optional[Callable[[int, str], None]] = None,
) -> dict[str, Any]:
    """Escanea todas las RRSS y web de un negocio y devuelve solo eventos nuevos y validados."""
    def _emit(pct: int, msg: str) -> None:
        if on_progress:
            try:
                on_progress(pct, msg)
            except Exception:
                pass

    negocio_id = negocio.get("id")
    nombre = str(negocio.get("nombre") or "").strip()
    pueblo = str(negocio.get("pueblo") or "").strip()

    urls_vistos = {normalizar_url(u) for u in (urls_existentes or []) if u}
    huellas_vistas = {str(h).strip().lower() for h in (huellas_existentes or []) if h}

    fuentes_config = [
        ("Instagram", negocio.get("instagramUrl") or ""),
        ("Facebook", negocio.get("facebookUrl") or ""),
        ("Twitter/X", negocio.get("twitterUrl") or ""),
        ("Web", negocio.get("webUrl") or ""),
    ]
    fuentes_activas = [(red, str(url).strip()) for red, url in fuentes_config if str(url).strip()]

    fuentes_recogidas: list[dict[str, Any]] = []
    if texto_manual and texto_manual.strip():
        _emit(25, "Procesando contenido proporcionado...")
        fuentes_recogidas.append({
            "redSocial": red_manual or "Instagram",
            "urlPerfil": normalizar_url(url_post_manual or negocio.get("instagramUrl") or ""),
            "texto": texto_manual.strip(),
            "imagenDefecto": "",
            "posts": [],
        })
    else:
        total_fuentes = max(1, len(fuentes_activas))
        for idx, (red, url) in enumerate(fuentes_activas):
            pct = 15 + int((idx / total_fuentes) * 40)
            _emit(pct, f"Leyendo contenido público de {red}...")
            rec = recolectar_contenido_fuente(url, red, nombre, pueblo)
            if rec["texto"] or rec.get("posts"):
                fuentes_recogidas.append(rec)

    if not fuentes_recogidas:
        _emit(100, "No se encontró contenido público accesible.")
        return {
            "negocioId": negocio_id,
            "negocioNombre": nombre,
            "fuentesAnalizadas": 0,
            "eventosNuevos": [],
            "duplicadosOmitidos": 0,
            "mensaje": "No se encontró contenido público accesible en las URLs configuradas.",
        }

    hoy_str = datetime.now(ZONA_MADRID).strftime("%Y-%m-%d")
    system_prompt = (
        "Eres un extractor experto de eventos, ofertas, promociones y actividades locales para comercios "
        "de pueblos de Almería (ReactivaTuPueblo). Analiza el contenido público de las redes sociales y web "
        "del negocio y extrae TODO lo que sea: eventos, fiestas, ferias, conciertos, talleres, cursos, "
        "ofertas temporales, promociones, descuentos, menús especiales, degustaciones, catas, maridajes, "
        "viajes organizados, excursiones, rutas, experiencias turísticas, paquetes, estancias, "
        "actividades deportivas, campamentos, campus, y cualquier comunicación con fecha concreta "
        "(futura o vigente) que invite a participar, comprar, reservar o asistir.\n"
        "NO inventes nada. NO extraigas horario habitual genérico (ej. 'abrimos de 9 a 21') salvo que "
        "sea una oferta/evento especial con fecha (ej. 'este sábado menú especial', 'puente de diciembre pack 2x1').\n"
        f"Fecha actual de referencia: {hoy_str} (zona horaria Europe/Madrid).\n"
        "Devuelve EXCLUSIVAMENTE un JSON con la forma:\n"
        '{"eventos": [{"nombre": "...", "descripcion": "...", "tipoEvento": 4, '
        '"fechaInicio": "YYYY-MM-DDTHH:MM:SS+01:00", "fechaFin": "YYYY-MM-DDTHH:MM:SS+01:00", '
        '"dePago": false, "aforo": 40, "imagen": "", "urlPost": "URL concreta del post/publicacion (no la del perfil) o vacio", "redSocial": "Instagram"}]}\n'
        "Categorías válidas para tipoEvento: 1=Turismo, 2=Fiesta Patronal, 3=Gastronomía, 4=Comercio, 5=Deportes, 6=Cultura.\n"
        "Si no hay ningún evento u oferta concreta, devuelve {\"eventos\": []}."
    )

    # Deduplicar publicaciones repetidas entre redes (una misma publicación puede aparecer
    # indexada en varias) y montar el contexto final que se manda a la IA.
    bloques_fuente: list[str] = []
    urls_posts_vistos: set[str] = set()
    textos_posts_vistos: set[str] = set()
    for f in fuentes_recogidas:
        lineas_posts: list[str] = []
        for p in f.get("posts") or []:
            url_post = normalizar_url(p.get("url", ""))
            texto_post = normalizar_texto(f"{p.get('titulo', '')} {p.get('resumen', '')}")
            if url_post and url_post in urls_posts_vistos:
                continue
            if texto_post and texto_post in textos_posts_vistos:
                continue
            if url_post:
                urls_posts_vistos.add(url_post)
            if texto_post:
                textos_posts_vistos.add(texto_post)
            lineas_posts.append(
                f"[POST INDEXADO {f['redSocial']}] URL: {p.get('url', '')}\n"
                f"Título: {p.get('titulo', '')}\nResumen: {p.get('resumen', '')}"
            )
        if lineas_posts:
            bloques_fuente.append(
                f"--- FUENTE: {f['redSocial']} ({f['urlPerfil']}) ---\n" + "\n\n".join(lineas_posts)
            )
        elif f.get("texto"):
            bloques_fuente.append(
                f"--- FUENTE: {f['redSocial']} ({f['urlPerfil']}) ---\n{f['texto'][:6500]}"
            )
    cuerpo_fuentes = "\n\n".join(bloques_fuente)
    user_prompt = (
        f"Negocio: {nombre}\n"
        f"Pueblo: {pueblo or 'Almería'}\n\n"
        f"CONTENIDO PÚBLICO RECOLECTADO:\n{cuerpo_fuentes}"
    )

    _emit(60, f"Analizando {len(fuentes_recogidas)} fuente(s) con IA...")
    raw_json = _invocar_llm_gratuito(system_prompt, user_prompt)
    _emit(78, "Validando eventos detectados y descartando duplicados...")
    raw_items = raw_json.get("eventos") if isinstance(raw_json, dict) else []
    if not isinstance(raw_items, list):
        raw_items = []

    perfil_por_red = {f["redSocial"].lower(): f for f in fuentes_recogidas}
    eventos_nuevos: list[dict[str, Any]] = []
    duplicados_omitidos = 0

    for item in raw_items:
        if not isinstance(item, dict):
            continue
        try:
            ev = EventoDetectado.model_validate(item)
        except ValidationError as exc:
            log.debug("Candidato descartado por validación: %s", exc)
            continue

        fechas = _normalizar_fechas(ev.fechaInicio, ev.fechaFin)
        if not fechas:
            continue
        fecha_ini_iso, fecha_fin_iso = fechas

        red_final = ev.redSocial or fuentes_recogidas[0]["redSocial"]
        fuente_info = perfil_por_red.get(red_final.lower(), fuentes_recogidas[0])

        url_candidata = normalizar_url(ev.urlPost or url_post_manual or "")
        url_perfil = normalizar_url(fuente_info["urlPerfil"])

        # Si el LLM devolvió la URL genérica del perfil/red (o vacía, o un enlace no concreto),
        # creamos una clave sintética única por oferta para no meter la URL de la red social
        # como urlPost (lo que provocaba falsos duplicados y que no se encontraran eventos nuevos).
        if not es_url_post_real(url_candidata, url_perfil):
            url_post_final = generar_url_sintetica(negocio_id or 0, red_final, ev.nombre, fecha_ini_iso)
        else:
            url_post_final = url_candidata

        huella = construir_huella(negocio_id or 0, ev.nombre, fecha_ini_iso).lower()

        if url_post_final in urls_vistos or huella in huellas_vistas:
            duplicados_omitidos += 1
            continue

        urls_vistos.add(url_post_final)
        huellas_vistas.add(huella)

        # Aforo mínimo 1 (el LLM a veces devuelve 0)
        aforo_final = ev.aforo if ev.aforo and ev.aforo >= 1 else 40
        eventos_nuevos.append({
            "nombre": ev.nombre.strip(),
            "descripcion": (ev.descripcion or f"Oferta/actividad detectada en {red_final} de {nombre}.").strip(),
            "tipoEvento": ev.tipoEvento,
            "fechaInicio": fecha_ini_iso,
            "fechaFin": fecha_fin_iso,
            "dePago": ev.dePago,
            "aforo": aforo_final,
            "imagen": ev.imagen.strip() or fuente_info.get("imagenDefecto", ""),
            "urlPost": url_post_final,
            "redSocial": red_final,
            "huella": huella,
        })

    return {
        "negocioId": negocio_id,
        "negocioNombre": nombre,
        "fuentesAnalizadas": len(fuentes_recogidas),
        "eventosNuevos": eventos_nuevos,
        "duplicadosOmitidos": duplicados_omitidos,
        "mensaje": f"Se detectaron {len(eventos_nuevos)} eventos nuevos ({duplicados_omitidos} duplicados omitidos).",
    }
