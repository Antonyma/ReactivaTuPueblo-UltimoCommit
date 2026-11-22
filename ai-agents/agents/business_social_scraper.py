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
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse
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

PALABRAS_SUBENLACE = (
    "evento", "eventos", "agenda", "oferta", "ofertas", "promo", "promocion",
    "actividad", "actividades", "taller", "talleres", "concierto", "menu", "carta",
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


class EventoDetectado(BaseModel):
    nombre: str = Field(..., min_length=3, max_length=160)
    descripcion: str = Field(default="")
    tipoEvento: int = Field(default=4, ge=1, le=6)
    fechaInicio: str = Field(..., description="ISO 8601 YYYY-MM-DDTHH:MM:SS+01:00 o YYYY-MM-DD")
    fechaFin: Optional[str] = Field(default=None)
    dePago: bool = Field(default=False)
    aforo: int = Field(default=40, ge=1, le=5000)
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


def _leer_con_jina(url: str, max_chars: int = 7000) -> str:
    try:
        jina_url = f"https://r.jina.ai/{url}"
        r = requests.get(
            jina_url,
            headers={"User-Agent": HEADERS["User-Agent"], "Accept": "text/plain"},
            allow_redirects=True,
            timeout=15.0,
        )
        if r.status_code == 200 and r.text:
            texto = r.text.strip()
            if len(texto) > 120 and "log in" not in texto[:250].lower():
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


def _buscar_ddg(queries: list[str], max_results: int = 5) -> list[dict[str, str]]:
    if DDGS is None:
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


def recolectar_contenido_fuente(
    url: str, red_social: str, nombre_negocio: str, pueblo: str
) -> dict[str, Any]:
    """Recoge texto público de una URL (Web, Instagram, Facebook o Twitter/X) de forma gratuita."""
    url_norm = normalizar_url(url)
    bloques: list[str] = []
    og_image = ""

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
        # Perfil público de red social: metadatos + Jina Reader + DuckDuckGo indexado
        html = _descargar_html(url_norm, timeout=10.0)
        if html:
            txt_meta, _, og_image = _limpiar_html(html, url_norm, max_chars=3000)
            if txt_meta and len(txt_meta) > 80:
                bloques.append(f"=== PERFIL {red_social.upper()} ({url_norm}) ===\n{txt_meta}")

        jina = _leer_con_jina(url_norm, max_chars=5500)
        if jina:
            bloques.append(f"=== CONTENIDO PÚBLICO {red_social.upper()} ({url_norm}) ===\n{jina}")

        handle = extraer_handle_rrss(url_norm, red_social)
        dominio = {
            "Instagram": "instagram.com",
            "Facebook": "facebook.com",
            "Twitter/X": "x.com",
        }.get(red_social, "")

        queries: list[str] = []
        if dominio and handle:
            queries.append(f'site:{dominio} "{handle}" (oferta OR evento OR promocion OR taller OR concierto OR menu OR actividad)')
            queries.append(f'site:{dominio}/{handle}')
        elif dominio and nombre_negocio:
            queries.append(f'site:{dominio} "{nombre_negocio}" "{pueblo}"')

        for r in _buscar_ddg(queries, max_results=5):
            bloques.append(
                f"[POST INDEXADO {red_social}] URL: {r['url']}\n"
                f"Título: {r['titulo']}\nResumen: {r['resumen']}"
            )

    return {
        "redSocial": red_social,
        "urlPerfil": url_norm,
        "texto": "\n\n".join(bloques).strip(),
        "imagenDefecto": og_image,
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
        })
    else:
        total_fuentes = max(1, len(fuentes_activas))
        for idx, (red, url) in enumerate(fuentes_activas):
            pct = 15 + int((idx / total_fuentes) * 40)
            _emit(pct, f"Leyendo contenido público de {red}...")
            rec = recolectar_contenido_fuente(url, red, nombre, pueblo)
            if rec["texto"]:
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
        "del negocio y extrae ÚNICAMENTE eventos, actividades, ofertas temporales, talleres, conciertos o "
        "promociones concretas futuras o vigentes (NO inventes nada, NO extraigas información genérica de "
        "horario habitual salvo que sea una oferta/evento especial).\n"
        f"Fecha actual de referencia: {hoy_str} (zona horaria Europe/Madrid).\n"
        "Devuelve EXCLUSIVAMENTE un JSON con la forma:\n"
        '{"eventos": [{"nombre": "...", "descripcion": "...", "tipoEvento": 4, '
        '"fechaInicio": "YYYY-MM-DDTHH:MM:SS+01:00", "fechaFin": "YYYY-MM-DDTHH:MM:SS+01:00", '
        '"dePago": false, "aforo": 40, "imagen": "", "urlPost": "URL concreta del post/publicacion (no la del perfil) o vacio", "redSocial": "Instagram"}]}\n'
        "Categorías válidas para tipoEvento: 1=Turismo, 2=Fiesta Patronal, 3=Gastronomía, 4=Comercio, 5=Deportes, 6=Cultura.\n"
        "Si no hay ningún evento u oferta concreta, devuelve {\"eventos\": []}."
    )

    cuerpo_fuentes = "\n\n".join(
        f"--- FUENTE: {f['redSocial']} ({f['urlPerfil']}) ---\n{f['texto'][:6500]}"
        for f in fuentes_recogidas
    )
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

        eventos_nuevos.append({
            "nombre": ev.nombre.strip(),
            "descripcion": (ev.descripcion or f"Oferta/actividad detectada en {red_final} de {nombre}.").strip(),
            "tipoEvento": ev.tipoEvento,
            "fechaInicio": fecha_ini_iso,
            "fechaFin": fecha_fin_iso,
            "dePago": ev.dePago,
            "aforo": ev.aforo,
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
