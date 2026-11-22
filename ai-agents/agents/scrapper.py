"""scrapper.py — Extractor de eventos de pueblos de Almería (ReactivaTuPueblo, Agente 1).

Fuentes:
  - Facebook oficial de cada ayuntamiento vía Apify (apify/facebook-posts-scraper).
  - Web del ayuntamiento con ScrapeGraphAI (SmartScraperGraph, scraping dirigido con LLM).
  - Respaldo de scrapper2: andalucia.com, La Voz de Almería, DuckDuckGo y Jina Reader.

Uso:
    python scrapper.py
    python scrapper.py --municipios lucainena,senes
    python scrapper.py --sin-apify --sin-scrapegraph     # equivale a scrapper2

Instalación:
    pip install httpx beautifulsoup4 python-dotenv openai pydantic ddgs apify-client scrapegraphai
    playwright install chromium
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import time
import unicodedata
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Literal, Optional
from urllib.parse import parse_qs, urlencode, urljoin, urlparse, urlunparse
from zoneinfo import ZoneInfo

import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from openai import APIStatusError, APITimeoutError, OpenAI, RateLimitError
from pydantic import BaseModel, Field, ValidationError, field_validator

try:
    from ddgs import DDGS
except ImportError:  # pragma: no cover
    from duckduckgo_search import DDGS

# ==============================================================================
# 1. CONFIGURACIÓN (.env, rutas, Apify, ScrapeGraphAI)
# ==============================================================================
# Configuración global: carga del .env, rutas de salida y parámetros de Apify / ScrapeGraphAI.
# --- Carga automática del .env subiendo por las carpetas del proyecto ---
BASE_DIR = Path(__file__).resolve().parent
for _ruta_env in (
    BASE_DIR / ".env",
    BASE_DIR.parent / ".env",
    BASE_DIR.parent.parent / ".env",
    BASE_DIR.parent.parent.parent / ".env",
):
    if _ruta_env.exists():
        load_dotenv(dotenv_path=_ruta_env, override=True)
        break
else:
    load_dotenv()


def env_bool(nombre: str, defecto: bool = False) -> bool:
    raw = os.getenv(nombre)
    if raw is None or not raw.strip():
        return defecto
    return raw.strip().lower() in ("1", "true", "si", "sí", "yes", "on")


def env_int(nombre: str, defecto: int) -> int:
    try:
        return int(os.getenv(nombre, "").strip())
    except ValueError:
        return defecto


ANIO_ACTUAL = datetime.now().year
ZONA_HORARIA = os.getenv("ZONA_HORARIA", "Europe/Madrid")

DIR_SALIDA = Path(os.getenv("DIR_SALIDA", "output"))
DIR_SALIDA.mkdir(parents=True, exist_ok=True)
ARCHIVO_ESTADO_CUOTAS = DIR_SALIDA / "estado_cuotas.json"

# --- Apify (Facebook Posts Scraper) ---
APIFY_TOKEN = os.getenv("APIFY_TOKEN") or os.getenv("APIFY_API_TOKEN", "")
APIFY_ACTOR_FACEBOOK = os.getenv("APIFY_ACTOR_FACEBOOK", "apify/facebook-posts-scraper")
APIFY_MAX_POSTS = env_int("APIFY_MAX_POSTS", 15)          # posts por página
APIFY_DIAS_ATRAS = env_int("APIFY_DIAS_ATRAS", 120)       # ventana temporal
APIFY_CACHE_HORAS = env_int("APIFY_CACHE_HORAS", 12)      # evita pagar dos veces la misma ejecución
ARCHIVO_CACHE_APIFY = DIR_SALIDA / "apify_facebook_cache.json"

# --- ScrapeGraphAI (scraping dirigido de la web del ayuntamiento) ---
SCRAPEGRAPH_ACTIVO = env_bool("SCRAPEGRAPH_ACTIVO", True)
# Orden propio: Gemini y Groq soportan mejor la salida estructurada (json_schema).
SCRAPEGRAPH_ORDEN = os.getenv("SCRAPEGRAPH_ORDEN", "gemini,groq,nvidia,openrouter")
SCRAPEGRAPH_HEADLESS = env_bool("SCRAPEGRAPH_HEADLESS", True)
SCRAPEGRAPH_MAX_SLOTS = env_int("SCRAPEGRAPH_MAX_SLOTS", 4)  # slots a probar por página
SCRAPEGRAPH_VERBOSE = env_bool("SCRAPEGRAPH_VERBOSE", False)

DOMINIOS_EXCLUIDOS = (
    "amazon.es",
    "comunidad.madrid",
    "calendario.org",
    "elmundo.es",
    "elpais.com",
    "abc.es",
    "20minutos.es",
    "as.com",
    "marca.com",
    "tripadvisor.",
    "alltrails.com",
    "youtube.com",
    "wikipedia.org",
    "reddit.com",
    "rtve.es",
    "expansion.com",
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
}

PALABRAS_CLAVE_EVENTO = (
    "fiesta", "fiestas", "feria", "romeria", "romería", "evento", "programa",
    "cultura", "concierto", "festival", "moros", "patron", "patrón",
    "semana-santa", "carnaval", "navidad", "verano", "ruta", "senderismo",
    "carrera", "cuento",
)

# ==============================================================================
# 2. MUNICIPIOS Y FUENTES
# ==============================================================================
# Catálogo de municipios y sus fuentes.
# Claves nuevas respecto a scrapper2:
#   - paginas_ayuntamiento: páginas que se procesan con ScrapeGraphAI (scraping dirigido).
#     Si ScrapeGraphAI falla en una, esa página vuelve al flujo clásico (httpx + BeautifulSoup + LLM).
#     Añade aquí subpáginas de agenda/noticias cuando las localices (p. ej. ".../agenda").
#   - facebook_url: se pasa a Apify. Vacío = sin página de Facebook conocida.
MUNICIPIOS: dict[str, dict[str, Any]] = {
    "lucainena": {
        "nombre_oficial": "Lucainena de las Torres",
        "coordenadas": "37.0411,-2.2006",
        "provincia": "Almería",
        "comunidad": "Andalucía",
        "paginas_ayuntamiento": ["https://www.lucainenadelastorres.es/"],
        "urls_directas": [
            "https://www.andalucia.com/province/almeria/lucainena/festivals",
            "https://www.lavozdealmeria.com/temas/lucainena-de-las-torres/",
        ],
        "lavoz_tema": "https://www.lavozdealmeria.com/temas/lucainena-de-las-torres/",
        "facebook_url": "https://www.facebook.com/profile.php?id=100064636603636",
        "queries_eventos": [
            f'"Lucainena de las Torres" (fiestas OR programa OR feria OR romería OR evento) {ANIO_ACTUAL}',
            f'"Lucainena de las Torres" ("festivo local" OR "Virgen de Montesión" OR "San Sebastián") {ANIO_ACTUAL}',
        ],
        "facebook_queries": [
            'site:facebook.com "100064636603636"',
            f'site:facebook.com "Lucainena de las Torres" (fiestas OR programa OR evento OR actividades) {ANIO_ACTUAL}',
        ],
    },
    "velefique": {
        "nombre_oficial": "Velefique",
        "coordenadas": "37.1939,-2.4036",
        "provincia": "Almería",
        "comunidad": "Andalucía",
        "paginas_ayuntamiento": ["https://www.velefique.es/"],
        "urls_directas": [
            "https://www.andalucia.com/province/almeria/velefique/festivals",
            "https://www.lavozdealmeria.com/temas/velefique/",
        ],
        "lavoz_tema": "https://www.lavozdealmeria.com/temas/velefique/",
        "facebook_url": "https://www.facebook.com/ayuntamientodevelefique.velefique",
        "queries_eventos": [
            f'"Velefique" Almería (fiestas OR programa OR "Semana Cultural" OR "Veleficuento" OR "San Roque") {ANIO_ACTUAL}',
            f'"Velefique" ("festivo local" OR "Moros y Cristianos" OR senderismo) {ANIO_ACTUAL}',
        ],
        "facebook_queries": [
            'site:facebook.com "ayuntamientodevelefique.velefique"',
            f'site:facebook.com "Velefique" (fiestas OR programa OR evento OR actividades) {ANIO_ACTUAL}',
        ],
    },
    "senes": {
        "nombre_oficial": "Senés",
        "coordenadas": "37.2044,-2.3469",
        "provincia": "Almería",
        "comunidad": "Andalucía",
        "paginas_ayuntamiento": ["https://www.senes.es/"],
        "urls_directas": [
            "https://www.andalucia.com/province/almeria/senes/festivals",
            "https://www.lavozdealmeria.com/temas/senes/",
        ],
        "lavoz_tema": "https://www.lavozdealmeria.com/temas/senes/",
        "facebook_url": "https://www.facebook.com/profile.php?id=61551352857893",
        "queries_eventos": [
            f'"Senés" Almería (fiestas OR programa OR "Divino Rostro" OR "Fiesta del Emigrante" OR evento) {ANIO_ACTUAL}',
            f'"Senés" Almería ("festivo local" OR "Moros y Cristianos" OR senderismo) {ANIO_ACTUAL}',
        ],
        "facebook_queries": [
            'site:facebook.com "61551352857893"',
            f'site:facebook.com "Senés" Almería (fiestas OR programa OR evento OR actividades) {ANIO_ACTUAL}',
        ],
    },
    "uleila": {
        "nombre_oficial": "Uleila del Campo",
        "coordenadas": "37.1853,-2.2039",
        "provincia": "Almería",
        "comunidad": "Andalucía",
        "paginas_ayuntamiento": ["https://www.uleiladelcampo.es/"],
        "urls_directas": [
            "https://www.andalucia.com/province/almeria/uleila-del-campo/festivals",
            "https://www.lavozdealmeria.com/temas/uleila-del-campo/",
        ],
        "lavoz_tema": "https://www.lavozdealmeria.com/temas/uleila-del-campo/",
        "facebook_url": "https://www.facebook.com/profile.php?id=100005289423529",
        "queries_eventos": [
            f'"Uleila del Campo" (fiestas OR programa OR "Santo Cristo" OR evento OR feria) {ANIO_ACTUAL}',
            f'"Uleila del Campo" ("festivo local" OR cultura OR deporte) {ANIO_ACTUAL}',
        ],
        "facebook_queries": [
            f'site:facebook.com "Uleila del Campo" (fiestas OR programa OR evento OR ayuntamiento) {ANIO_ACTUAL}',
            'site:facebook.com "Ayuntamiento de Uleila del Campo"',
        ],
    },
}

# ==============================================================================
# 3. VALIDACIÓN (PYDANTIC)
# ==============================================================================
# Esquemas Pydantic: validación final (EventoFestivo) y esquema de salida para ScrapeGraphAI.
TIPOS_PERMITIDOS = (
    "festivo_local",
    "fiesta_patronal",
    "evento_cultural",
    "evento_deportivo",
    "concierto_verbena",
    "mercado_feria",
    "otro",
)


class EventoFestivo(BaseModel):
    titulo: str
    tipo: Literal[
        "festivo_local",
        "fiesta_patronal",
        "evento_cultural",
        "evento_deportivo",
        "concierto_verbena",
        "mercado_feria",
        "otro",
    ]
    fecha_inicio: str = Field(..., description="YYYY-MM-DD o YYYY-MM")
    fecha_fin: Optional[str] = None
    hora_inicio: Optional[str] = None
    ubicacion: Optional[str] = None
    descripcion: str = ""
    origen: Literal["web_oficial", "red_social", "agenda_publica"] = "agenda_publica"
    fuente_url: str

    @field_validator("titulo", "fecha_inicio", mode="before")
    @classmethod
    def no_vacio(cls, v: Any) -> str:
        val = "" if v is None else str(v).strip()
        if not val:
            raise ValueError("campo vacío")
        return val

    @field_validator("descripcion", mode="before")
    @classmethod
    def normalizar_descripcion(cls, v: Any) -> str:
        return "" if v is None else str(v).strip()

    @field_validator("tipo", mode="before")
    @classmethod
    def normalizar_tipo(cls, v: Any) -> str:
        val = str(v).strip().lower() if v else "otro"
        return val if val in TIPOS_PERMITIDOS else "otro"

    @field_validator("origen", mode="before")
    @classmethod
    def normalizar_origen(cls, v: Any) -> str:
        val = str(v).strip().lower() if v else "agenda_publica"
        if "|" in val:
            val = val.split("|")[0].strip()
        if "facebook" in val or "instagram" in val or "red_social" in val:
            return "red_social"
        if val in ("web_oficial", "red_social", "agenda_publica"):
            return val
        return "agenda_publica"


class LoteExtraccion(BaseModel):
    items: list[EventoFestivo] = Field(default_factory=list)


# --- Esquema "relajado" para ScrapeGraphAI ---
# Se pasa como `schema` al SmartScraperGraph. Campos simples (str/Optional) para que
# los modelos gratuitos lo respeten; la validación estricta se hace luego con EventoFestivo.
class EventoWeb(BaseModel):
    titulo: str = Field(description="Nombre del evento o fiesta, en español")
    tipo: str = Field(default="otro", description="Uno de: " + ", ".join(TIPOS_PERMITIDOS))
    fecha_inicio: str = Field(description="Fecha de inicio YYYY-MM-DD (o YYYY-MM si solo hay mes)")
    fecha_fin: Optional[str] = Field(default=None, description="Fecha de fin YYYY-MM-DD o null")
    hora_inicio: Optional[str] = Field(default=None, description="Hora HH:MM o null")
    ubicacion: Optional[str] = Field(default=None, description="Lugar dentro del municipio")
    descripcion: str = Field(default="", description="Resumen breve del programa")
    fuente_url: Optional[str] = Field(default=None, description="URL concreta donde aparece el evento")


class LoteWeb(BaseModel):
    items: list[EventoWeb] = Field(default_factory=list)

# ==============================================================================
# 4. ENRUTADOR DE LLMs (LLM_ORDEN + *_API_KEY)
# ==============================================================================
# Enrutador de LLMs gratuitos (LLM_ORDEN + *_API_KEY) con rotación de keys y cooldowns persistentes.
#
# Lo usan dos consumidores:
#   - extractor_llm (texto -> JSON) mediante `generar_json`.
#   - ScrapeGraphAI, que necesita la config del slot (`slots_disponibles`) y avisar de errores
#     (`registrar_error`) para que el slot quede pausado también para el resto del pipeline.
def _leer_claves_env(*nombres: str) -> list[str]:
    claves: list[str] = []
    for nombre in nombres:
        for item in os.getenv(nombre, "").split(","):
            val = item.strip()
            if val and val not in claves:
                claves.append(val)
    return claves


def _leer_modelos_env(env_models: str, por_defecto: list[str]) -> list[str]:
    raw = os.getenv(env_models, "").strip()
    if not raw:
        return por_defecto
    return [m.strip() for m in raw.split(",") if m.strip()]


CATALOGO_BASE: dict[str, dict[str, Any]] = {
    "nvidia": {
        "proveedor": "NVIDIA NIM",
        "env_keys": ("NVIDIA_API_KEY", "NVIDIA_API_KEYS"),
        "base_url": "https://integrate.api.nvidia.com/v1",
        "env_models": "NVIDIA_MODELS",
        "modelos": ["meta/llama-3.3-70b-instruct"],
        "json_mode": False,
        "max_chars_prompt": 28000,
        "model_tokens": 32000,
    },
    "openrouter": {
        "proveedor": "OpenRouter Free",
        "env_keys": ("OPENROUTER_API_KEY", "OPENROUTER_API_KEYS"),
        "base_url": "https://openrouter.ai/api/v1",
        "env_models": "OPENROUTER_MODELS",
        "modelos": [
            "openrouter/free"
        ],
        "json_mode": False,
        "max_chars_prompt": 24000,
        "model_tokens": 32000,
    },
    "gemini": {
        "proveedor": "Google AI Studio",
        "env_keys": ("GEMINI_API_KEY", "GEMINI_API_KEYS"),
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "env_models": "GEMINI_MODELS",
        "modelos": ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
        "json_mode": True,
        "max_chars_prompt": 34000,
        "model_tokens": 128000,
    },
}


def construir_catalogo_proveedores(orden_raw: str) -> list[dict[str, Any]]:
    orden = [p.strip().lower() for p in orden_raw.split(",") if p.strip()]
    slots: list[dict[str, Any]] = []
    for clave_prov in orden:
        d = CATALOGO_BASE.get(clave_prov)
        if not d:
            continue
        modelos = _leer_modelos_env(d["env_models"], d["modelos"])
        for idx, api_key in enumerate(_leer_claves_env(*d["env_keys"]), start=1):
            key_hash = hashlib.sha256(api_key.encode()).hexdigest()[:8]
            for modelo in modelos:
                slots.append(
                    {
                        "clave_prov": clave_prov,
                        "slot_id": f"{d['proveedor']}|key{idx}_{key_hash}|{modelo}",
                        "etiqueta": f"{d['proveedor']} [Key #{idx}] -> {modelo}",
                        "base_url": d["base_url"],
                        "api_key": api_key,
                        "model": modelo,
                        "json_mode": d["json_mode"],
                        "max_chars_prompt": d["max_chars_prompt"],
                        "model_tokens": int(os.getenv("SCRAPEGRAPH_MODEL_TOKENS", d["model_tokens"])),
                    }
                )
    return slots


AccionError = Literal["pausado", "estructura", "entorno", "siguiente"]


class ProductionLLMRouter:
    def __init__(
        self,
        orden_raw: str | None = None,
        archivo_estado: Path = ARCHIVO_ESTADO_CUOTAS,
    ) -> None:
        self.archivo_estado = archivo_estado
        self.slots = construir_catalogo_proveedores(
            orden_raw or os.getenv("LLM_ORDEN", "nvidia,openrouter,gemini")
        )
        self.cooldowns: dict[str, float] = self._cargar_estado()
        if not self.slots:
            raise RuntimeError("No se encontraron API keys válidas en el .env para el orden de LLMs indicado.")

    # ------------------------------------------------------------------ estado
    def _cargar_estado(self) -> dict[str, float]:
        if not self.archivo_estado.exists():
            return {}
        try:
            data = json.loads(self.archivo_estado.read_text(encoding="utf-8"))
            ahora = time.time()
            return {k: float(v) for k, v in data.items() if float(v) > ahora}
        except Exception:
            return {}

    def _guardar_estado(self) -> None:
        # Fusiona con lo que haya en disco: hay dos routers (texto y ScrapeGraph) compartiendo archivo.
        en_disco = self._cargar_estado()
        en_disco.update(self.cooldowns)
        self.cooldowns = en_disco
        self.archivo_estado.write_text(json.dumps(self.cooldowns, indent=2), encoding="utf-8")

    def pausar_slot(self, slot: dict[str, Any], segundos: int, motivo: str) -> None:
        self.cooldowns[slot["slot_id"]] = time.time() + segundos
        self._guardar_estado()
        reintento = (datetime.now() + timedelta(seconds=segundos)).strftime("%H:%M:%S")
        print(f"  [!] {slot['etiqueta']} bloqueado ({motivo}). Pausado hasta {reintento}. Cambiando...")

    def slots_disponibles(self) -> list[dict[str, Any]]:
        self.cooldowns.update(self._cargar_estado())
        ahora = time.time()
        return [s for s in self.slots if ahora >= self.cooldowns.get(s["slot_id"], 0)]

    # --------------------------------------------------------- clasificación
    def registrar_error(self, slot: dict[str, Any], exc: Exception) -> AccionError:
        """Clasifica un error (también los que llegan envueltos por LangChain/ScrapeGraphAI)."""
        msg = str(exc).lower()
        status = getattr(exc, "status_code", None)
        if status is None:
            m = re.search(r"error code:\s*(\d{3})", msg)
            status = int(m.group(1)) if m else None

        if "playwright" in msg or "executable doesn't exist" in msg or "browsertype.launch" in msg:
            return "entorno"
        if isinstance(exc, RateLimitError) or status == 429 or "rate limit" in msg or "quota" in msg:
            diaria = any(p in msg for p in ("day", "daily", "quota", "per-day", "perday"))
            self.pausar_slot(slot, 21600 if diaria else 65, "RateLimit 429")
            return "pausado"
        if status in (401, 402, 403):
            self.pausar_slot(slot, 43200, f"Auth/Cuota {status}")
            return "pausado"
        if status in (500, 502, 503, 504):
            self.pausar_slot(slot, 300, f"HTTP {status}")
            return "pausado"
        if status in (400, 404, 422) and any(
            p in msg for p in ("response_format", "json_schema", "structured", "tool", "function")
        ):
            return "estructura"
        return "siguiente"

    # ------------------------------------------------------ texto -> JSON
    def generar_json(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        disponibles = self.slots_disponibles()
        if not disponibles:
            raise RuntimeError("Todos los modelos y API Keys gratuitos están en pausa por límite de cuota.")

        for slot in disponibles:
            client = OpenAI(api_key=slot["api_key"], base_url=slot["base_url"], timeout=45.0, max_retries=0)
            kwargs: dict[str, Any] = {
                "model": slot["model"],
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt[: slot["max_chars_prompt"]]},
                ],
                "temperature": 0.1,
            }
            if slot["json_mode"]:
                kwargs["response_format"] = {"type": "json_object"}
            if slot["clave_prov"] == "gemini" and os.getenv("GEMINI_THINKING_BUDGET") == "0":
                kwargs["extra_body"] = {"thinking_budget": 0}

            for intento in range(2):
                try:
                    print(f"  -> LLM activo: {slot['etiqueta']} (intento {intento + 1})")
                    resp = client.chat.completions.create(**kwargs)
                    contenido = resp.choices[0].message.content or ""
                    if not contenido.strip():
                        raise ValueError("Respuesta vacía del modelo")
                    return self.extraer_objeto_json(contenido)

                except RateLimitError as e:
                    self.registrar_error(slot, e)
                    break
                except APIStatusError as e:
                    if e.status_code == 400 and "response_format" in kwargs:
                        kwargs.pop("response_format", None)
                        continue
                    if self.registrar_error(slot, e) != "pausado":
                        print(f"  [!] {slot['etiqueta']} devolvió HTTP {e.status_code}. Probando siguiente...")
                    break
                except (json.JSONDecodeError, ValueError) as e:
                    print(f"  [!] {slot['etiqueta']} devolvió formato inválido ({type(e).__name__}).")
                    if intento == 1:
                        print("      Saltando al siguiente modelo sin bloquear la key...")
                except APITimeoutError:
                    print(f"  [!] Timeout en {slot['etiqueta']}. Probando siguiente modelo...")
                    break
                except Exception as e:  # noqa: BLE001
                    print(f"  [!] Error inesperado en {slot['etiqueta']}: {e}")
                    break

        raise RuntimeError("Ningún modelo disponible pudo completar la extracción en esta ronda.")

    @staticmethod
    def extraer_objeto_json(texto: str) -> dict[str, Any]:
        limpio = re.sub(r"<think>.*?</think>", "", texto, flags=re.DOTALL | re.IGNORECASE).strip()
        limpio = re.sub(r"^```(?:json)?\s*|\s*```$", "", limpio, flags=re.IGNORECASE).strip()
        ini, fin = limpio.find("{"), limpio.rfind("}")
        if ini != -1 and fin != -1:
            limpio = limpio[ini : fin + 1]
        return json.loads(limpio)

# ==============================================================================
# 5. FUENTES CLÁSICAS (httpx + BS4, La Voz, DuckDuckGo, Jina)
# ==============================================================================
# Fuentes clásicas de scrapper2: httpx + BeautifulSoup, La Voz de Almería, DuckDuckGo y Jina Reader.
#
# Siguen funcionando como respaldo cuando Apify o ScrapeGraphAI no están disponibles.
REDES_SOCIALES = ("facebook.com", "instagram.com", "x.com", "twitter.com")


def es_url_valida(href: str) -> bool:
    if not href or not href.startswith("http"):
        return False
    dominio = urlparse(href).netloc.lower()
    if any(excl in dominio for excl in DOMINIOS_EXCLUIDOS):
        return False
    return not any(rrss in dominio for rrss in REDES_SOCIALES)


def descargar_html(url: str) -> str:
    for verificar_ssl in (True, False):
        try:
            with httpx.Client(
                headers=HEADERS, follow_redirects=True, timeout=15.0, http2=False, verify=verificar_ssl
            ) as client:
                resp = client.get(url)
                resp.raise_for_status()
                return resp.text
        except httpx.ConnectError:
            continue
        except Exception as e:  # noqa: BLE001
            print(f"  [!] Error descargando {url}: {e}")
            return ""
    return ""


def limpiar_soup(html: str, max_chars: int = 8000) -> str:
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    metas = []
    for prop in ("og:title", "og:description", "description"):
        tag = soup.find("meta", attrs={"property": prop}) or soup.find("meta", attrs={"name": prop})
        if tag and tag.get("content"):
            metas.append(str(tag["content"]).strip())

    for ruido in soup(["script", "style", "nav", "footer", "header", "aside", "noscript", "svg"]):
        ruido.decompose()

    lineas = [l.strip() for l in soup.get_text(separator="\n").splitlines()]
    cuerpo = "\n".join(l for l in lineas if len(l) > 2)
    cabecera = "\n".join(dict.fromkeys(metas))
    return f"{cabecera}\n{cuerpo}".strip()[:max_chars]


def extraer_articulos_lavoz(url_tema: str, max_articulos: int = 3) -> list[str]:
    html_tema = descargar_html(url_tema)
    if not html_tema:
        return []

    soup = BeautifulSoup(html_tema, "html.parser")
    enlaces: list[str] = []
    slug_tema = urlparse(url_tema).path.strip("/").split("/")[-1].lower()
    raiz_municipio = slug_tema.split("-")[0]

    for a in soup.find_all("a", href=True):
        href = urljoin(url_tema, a["href"])
        texto_enlace = a.get_text(" ", strip=True).lower()
        ruta = urlparse(href).path.lower()

        if "lavozdealmeria.com" not in href or "/temas/" in ruta:
            continue
        segmentos = [s for s in ruta.split("/") if s]
        if len(segmentos) < 2 or (not ruta.endswith(".html") and len(segmentos[-1]) < 15):
            continue
        menciona_muni = (
            raiz_municipio in ruta
            or raiz_municipio in texto_enlace
            or slug_tema.replace("-", " ") in texto_enlace
        )
        if not menciona_muni:
            continue
        if any(p in ruta or p in texto_enlace for p in PALABRAS_CLAVE_EVENTO) and href not in enlaces:
            enlaces.append(href)

    bloques: list[str] = []
    for art_url in enlaces[:max_articulos]:
        print(f"  Scraping noticia La Voz -> {art_url}")
        texto_art = limpiar_soup(descargar_html(art_url), max_chars=4500)
        if texto_art:
            bloques.append(f"--- NOTICIA LA VOZ DE ALMERÍA: {art_url} ---\n{texto_art}")
    return bloques


def buscar_prensa(queries_eventos: list[str]) -> tuple[list[str], list[str]]:
    """Devuelve (urls de prensa/agenda a scrapear, snippets indexados)."""
    urls: list[str] = []
    snippets: list[str] = []
    with DDGS() as ddgs:
        for q in queries_eventos:
            try:
                for r in ddgs.text(q, region="es-es", max_results=4):
                    href, cuerpo, titulo = r.get("href", ""), r.get("body", ""), r.get("title", "")
                    if es_url_valida(href):
                        if href not in urls:
                            urls.append(href)
                        if cuerpo:
                            snippets.append(f"[RESULTADO INDEXADO] URL: {href}\nTítulo: {titulo}\nResumen: {cuerpo}")
                time.sleep(0.7)
            except Exception as e:  # noqa: BLE001
                print(f"  [!] Aviso búsqueda prensa '{q}': {e}")
    return urls, snippets


def facebook_respaldo(fb_url: str, fb_queries: list[str]) -> list[str]:
    """Respaldo sin Apify: Jina Reader + posts indexados en DuckDuckGo (lo que hacía scrapper2)."""
    bloques: list[str] = []
    if fb_url:
        try:
            with httpx.Client(headers=HEADERS, timeout=18.0, http2=False) as client:
                resp = client.get(f"https://r.jina.ai/{fb_url}")
                if resp.status_code == 200 and len(resp.text.strip()) > 200:
                    texto_fb = resp.text.strip()[:6500]
                    if "inicia sesión" not in texto_fb.lower()[:300]:
                        bloques.append(f"--- PÁGINA FACEBOOK ({fb_url}) ---\n{texto_fb}")
        except Exception:  # noqa: BLE001
            pass

    if fb_queries:
        with DDGS() as ddgs:
            for q in fb_queries:
                try:
                    for r in ddgs.text(q, region="es-es", max_results=4):
                        cuerpo = r.get("body", "")
                        if cuerpo:
                            bloques.append(
                                f"[POST FACEBOOK INDEXADO] URL: {r.get('href', fb_url)}\n"
                                f"Título: {r.get('title', '')}\nTexto: {cuerpo}"
                            )
                    time.sleep(0.7)
                except Exception as e:  # noqa: BLE001
                    print(f"  [!] Aviso búsqueda FB '{q}': {e}")
    return bloques

# ==============================================================================
# 6. FACEBOOK VÍA APIFY (apify/facebook-posts-scraper)
# ==============================================================================
# Publicaciones de las páginas de Facebook de los ayuntamientos vía Apify (apify/facebook-posts-scraper).
#
# - Se lanza UNA sola ejecución del actor con todas las páginas (más barato y rápido que una por pueblo).
# - El resultado se cachea en output/apify_facebook_cache.json durante APIFY_CACHE_HORAS para no
#   gastar créditos al relanzar el pipeline mientras desarrollas.
# - Se aprovecha el OCR de las imágenes (`media[].ocrText`): muchos carteles de fiestas solo
#   tienen la fecha dentro de la imagen.
def normalizar_url_facebook(url: str) -> str:
    """Quita parámetros irrelevantes (locale, etc.) conservando `id` en profile.php."""
    if not url:
        return ""
    p = urlparse(url.strip())
    query = parse_qs(p.query)
    query_limpia = urlencode({"id": query["id"][0]}) if "id" in query else ""
    ruta = p.path if p.path.endswith(".php") else p.path.rstrip("/") + "/"
    return urlunparse(("https", "www.facebook.com", ruta, "", query_limpia, ""))


def _simplificar_post(item: dict[str, Any]) -> dict[str, Any]:
    ocr = []
    for m in item.get("media") or []:
        if isinstance(m, dict) and m.get("ocrText"):
            ocr.append(str(m["ocrText"]).strip())
    return {
        "url": item.get("url") or item.get("topLevelUrl") or item.get("facebookUrl"),
        "fecha_publicacion": item.get("time"),
        "texto": (item.get("text") or "").strip(),
        "ocr_imagenes": " | ".join(ocr),
        "enlace": item.get("link"),
        "pagina": item.get("pageName"),
        "likes": item.get("likes"),
    }


def _dataset_id(run: Any) -> str | None:
    """Compatible con apify-client v1 (dict) y v2 (objeto con atributos)."""
    if run is None:
        return None
    if isinstance(run, dict):
        return run.get("defaultDatasetId")
    return getattr(run, "default_dataset_id", None)


def _estado(run: Any) -> str:
    if isinstance(run, dict):
        return str(run.get("status", ""))
    return str(getattr(run, "status", ""))


class ApifyFacebookFuente:
    def __init__(
        self,
        token: str = APIFY_TOKEN,
        actor: str = APIFY_ACTOR_FACEBOOK,
        max_posts: int = APIFY_MAX_POSTS,
        dias_atras: int = APIFY_DIAS_ATRAS,
        cache_horas: int = APIFY_CACHE_HORAS,
    ) -> None:
        self.token = token
        self.actor = actor
        self.max_posts = max_posts
        self.dias_atras = dias_atras
        self.cache_horas = cache_horas

    @property
    def disponible(self) -> bool:
        return bool(self.token)

    # ---------------------------------------------------------------- caché
    def _parametros(self) -> dict[str, Any]:
        return {"actor": self.actor, "max_posts": self.max_posts, "dias": self.dias_atras}

    def _leer_cache(self, urls: list[str]) -> dict[str, list[dict[str, Any]]] | None:
        if not ARCHIVO_CACHE_APIFY.exists() or self.cache_horas <= 0:
            return None
        try:
            data = json.loads(ARCHIVO_CACHE_APIFY.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            return None
        fresca = time.time() - data.get("generado", 0) < self.cache_horas * 3600
        if fresca and data.get("parametros") == self._parametros() and all(u in data.get("posts", {}) for u in urls):
            print(f"  [Apify] Usando caché ({ARCHIVO_CACHE_APIFY}).")
            return {u: data["posts"][u] for u in urls}
        return None

    def _guardar_cache(self, posts: dict[str, list[dict[str, Any]]]) -> None:
        ARCHIVO_CACHE_APIFY.write_text(
            json.dumps(
                {"generado": time.time(), "parametros": self._parametros(), "posts": posts},
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

    # ---------------------------------------------------------- ejecución
    def obtener_posts(self, urls_facebook: list[str]) -> dict[str, list[dict[str, Any]]]:
        """Devuelve {url_normalizada: [posts simplificados]} para todas las páginas pedidas."""
        urls = sorted({normalizar_url_facebook(u) for u in urls_facebook if u})
        if not urls or not self.disponible:
            return {}

        cache = self._leer_cache(urls)
        if cache is not None:
            return cache

        try:
            from apify_client import ApifyClient
        except ImportError:
            print("  [!] apify-client no instalado (pip install apify-client). Se usa el respaldo Jina/DDG.")
            return {}

        run_input = {
            "startUrls": [{"url": u} for u in urls],
            "resultsLimit": self.max_posts,
            "onlyPostsNewerThan": f"{self.dias_atras} days",
            "captionText": False,
        }
        print(f"  [Apify] Lanzando {self.actor} sobre {len(urls)} páginas (máx. {self.max_posts} posts/página)...")
        try:
            client = ApifyClient(self.token)
            run = client.actor(self.actor).call(run_input=run_input)
        except Exception as e:  # noqa: BLE001
            print(f"  [!] Error ejecutando el actor de Apify: {e}")
            return {}

        dataset_id = _dataset_id(run)
        if not dataset_id:
            print("  [!] La ejecución de Apify no devolvió dataset.")
            return {}
        if _estado(run) and "SUCCEEDED" not in _estado(run).upper():
            print(f"  [!] Apify terminó con estado {_estado(run)}; se aprovechan los resultados parciales.")

        agrupado: dict[str, list[dict[str, Any]]] = {u: [] for u in urls}
        sin_asignar = 0
        for item in client.dataset(dataset_id).iterate_items():
            if item.get("error"):
                print(f"  [!] Apify: {item.get('error')} ({item.get('url') or item.get('inputUrl')})")
                continue
            clave = normalizar_url_facebook(item.get("inputUrl") or item.get("facebookUrl") or "")
            if clave not in agrupado:
                if len(urls) == 1:
                    clave = urls[0]
                else:
                    sin_asignar += 1
                    continue
            agrupado[clave].append(_simplificar_post(item))

        total = sum(len(v) for v in agrupado.values())
        print(f"  [Apify] {total} posts recibidos" + (f" ({sin_asignar} sin página asignada)" if sin_asignar else ""))
        self._guardar_cache(agrupado)
        return agrupado


def posts_a_bloque(posts: list[dict[str, Any]], fb_url: str, max_chars: int = 9000) -> str:
    """Convierte los posts en un bloque de texto para el LLM, con la fecha de publicación
    (clave para resolver 'este sábado', 'mañana', etc.)."""
    trozos: list[str] = []
    for p in posts:
        if not p.get("texto") and not p.get("ocr_imagenes"):
            continue
        partes = [
            f"[POST FACEBOOK OFICIAL] Publicado: {p.get('fecha_publicacion') or 'desconocido'}",
            f"URL: {p.get('url') or fb_url}",
        ]
        if p.get("texto"):
            partes.append(f"Texto: {p['texto'][:1500]}")
        if p.get("ocr_imagenes"):
            partes.append(f"Texto dentro de la imagen (OCR): {p['ocr_imagenes'][:700]}")
        if p.get("enlace"):
            partes.append(f"Enlace: {p['enlace']}")
        trozos.append("\n".join(partes))
    if not trozos:
        return ""
    return (f"--- FACEBOOK OFICIAL DEL AYUNTAMIENTO vía Apify ({fb_url}) ---\n" + "\n\n".join(trozos))[:max_chars]

# ==============================================================================
# 7. WEB DEL AYUNTAMIENTO VÍA SCRAPEGRAPHAI
# ==============================================================================
# Scraping dirigido de la web del ayuntamiento con ScrapeGraphAI (SmartScraperGraph).
#
# ScrapeGraphAI renderiza la página con Playwright (sirve para webs con JavaScript, que httpx+bs4
# no veía), la trocea y le pide al LLM que rellene directamente el esquema `LoteWeb`.
#
# El LLM sale del mismo enrutador de keys gratuitas: cada slot (proveedor + key + modelo) se pasa a
# ScrapeGraphAI como endpoint compatible con OpenAI ("openai/<modelo>" + base_url). Si un slot da 429,
# queda pausado en output/estado_cuotas.json también para el resto del pipeline.
#
# Devuelve:
#   - list[EventoFestivo]  -> extracción correcta (puede ser [] si la página no tiene eventos)
#   - None                 -> no se pudo extraer; el pipeline manda la página al flujo clásico
FORMATO_JSON = (
    '\nDevuelve EXCLUSIVAMENTE un JSON con este formato: {"items": [{"titulo": "...", "tipo": "fiesta_patronal", '
    '"fecha_inicio": "YYYY-MM-DD", "fecha_fin": null, "hora_inicio": null, "ubicacion": null, '
    '"descripcion": "...", "fuente_url": null}]}'
)


def construir_prompt(config_muni: dict[str, Any]) -> str:
    return (
        f"Esta es la web oficial del Ayuntamiento de {config_muni['nombre_oficial']} "
        f"({config_muni['provincia']}). Extrae TODOS los eventos, fiestas patronales, romerías, ferias, "
        "conciertos, verbenas, actividades culturales y deportivas y festivos locales del municipio que "
        "aparezcan en la página (agenda, noticias, bandos, carteles, programas de fiestas).\n"
        f"- Año objetivo {ANIO_ACTUAL}. Si hay día y mes sin año usa {ANIO_ACTUAL}-MM-DD; si solo hay mes, {ANIO_ACTUAL}-MM.\n"
        "- No incluyas festivos nacionales genéricos (Año Nuevo, Reyes, 1 de mayo, 12 de octubre, Navidad) "
        "ni eventos de otros municipios.\n"
        f"- 'tipo' debe ser uno de: {', '.join(TIPOS_PERMITIDOS)}.\n"
        "- Títulos y descripciones en español. 'fuente_url' = enlace concreto de la noticia o evento si existe.\n"
        "- Si no hay ningún evento, devuelve items vacío."
    )


def _config_scrapegraph(slot: dict[str, Any]) -> dict[str, Any]:
    return {
        "llm": {
            "model": f"openai/{slot['model']}",
            "api_key": slot["api_key"],
            "base_url": slot["base_url"],
            "model_tokens": slot["model_tokens"],
            "temperature": 0,
        },
        "verbose": SCRAPEGRAPH_VERBOSE,
        "headless": SCRAPEGRAPH_HEADLESS,
    }


def _extraer_items(resultado: Any) -> list[dict[str, Any]] | None:
    """ScrapeGraphAI devuelve formatos distintos según modelo/versión: los normalizamos."""
    if resultado is None:
        return None
    if hasattr(resultado, "model_dump"):
        resultado = resultado.model_dump()
    if isinstance(resultado, str):
        if "no answer found" in resultado.lower():
            return None
        try:
            resultado = ProductionLLMRouter.extraer_objeto_json(resultado)
        except (json.JSONDecodeError, ValueError):
            return None
    if isinstance(resultado, list):
        return [r for r in resultado if isinstance(r, dict)]
    if isinstance(resultado, dict):
        for clave in ("items", "eventos", "events"):
            if isinstance(resultado.get(clave), list):
                return [r for r in resultado[clave] if isinstance(r, dict)]
        if "content" in resultado:
            return _extraer_items(resultado["content"])
        if "titulo" in resultado:
            return [resultado]
        for valor in resultado.values():  # último recurso: primera lista de dicts
            if isinstance(valor, list) and all(isinstance(v, dict) for v in valor):
                return valor
        if not resultado or resultado == {"items": []}:
            return []
    return None


def _a_eventos(items: list[dict[str, Any]], url_pagina: str) -> list[EventoFestivo]:
    eventos: list[EventoFestivo] = []
    for it in items:
        datos = dict(it)
        datos["origen"] = "web_oficial"
        url = str(datos.get("fuente_url") or "").strip()
        datos["fuente_url"] = url if url.startswith("http") else url_pagina
        try:
            eventos.append(EventoFestivo.model_validate(datos))
        except ValidationError as e:
            print(f"    [!] Evento descartado ({datos.get('titulo')!r}): {e.errors()[0]['msg']}")
    return eventos


def extraer_eventos_web(
    url: str, config_muni: dict[str, Any], router: ProductionLLMRouter
) -> list[EventoFestivo] | None:
    try:
        from scrapegraphai.graphs import SmartScraperGraph
    except ImportError:
        print("  [!] scrapegraphai no instalado (pip install scrapegraphai && playwright install chromium).")
        return None

    print(f"  [ScrapeGraphAI] Scraping dirigido -> {url}")
    prompt = construir_prompt(config_muni)
    slots = router.slots_disponibles()[:SCRAPEGRAPH_MAX_SLOTS]
    if not slots:
        print("  [!] ScrapeGraphAI: todos los slots están en pausa.")
        return None

    for slot in slots:
        # 1º con esquema Pydantic (salida estructurada). Si el proveedor no la soporta, sin esquema.
        for usar_schema in (True, False):
            try:
                print(f"    -> LLM: {slot['etiqueta']} ({'con' if usar_schema else 'sin'} schema)")
                grafo = SmartScraperGraph(
                    prompt=prompt if usar_schema else prompt + FORMATO_JSON,
                    source=url,
                    config=_config_scrapegraph(slot),
                    schema=LoteWeb if usar_schema else None,
                )
                items = _extraer_items(grafo.run())
                if items is None:
                    raise ValueError("respuesta sin formato reconocible")
                eventos = _a_eventos(items, url)
                print(f"    [OK] {len(eventos)} eventos desde la web oficial.")
                return eventos

            except Exception as e:  # noqa: BLE001  (ScrapeGraphAI/LangChain envuelven los errores)
                accion = router.registrar_error(slot, e)
                if accion == "entorno":
                    print(f"  [!] Falta el navegador de Playwright: ejecuta `playwright install chromium`.\n      {e}")
                    return None
                if usar_schema and accion in ("estructura", "siguiente"):
                    print(f"    [!] Falló con schema ({type(e).__name__}); reintentando sin schema...")
                    continue
                if accion != "pausado":
                    print(f"    [!] {slot['etiqueta']} falló ({type(e).__name__}: {str(e)[:160]}).")
                break

    return None

# ==============================================================================
# 8. EXTRACCIÓN TEXTO -> EVENTOS CON LLM
# ==============================================================================
# Extracción texto -> eventos con el enrutador de LLMs (lo que hacía procesar_municipio en scrapper2).
MAX_CONTEXTO = 34000

SYSTEM_PROMPT = (
    "Eres un extractor experto en fiestas, tradiciones y agenda de eventos municipales de España.\n"
    "REGLAS ESTRICTAS:\n"
    "1. Extrae TODOS los eventos, fiestas patronales, romerías, festivales, conciertos, actividades culturales, "
    "deportivas y festivos locales del municipio indicado que aparezcan en las fuentes.\n"
    "2. Muchas fuentes como andalucia.com están en INGLÉS: traduce los títulos y descripciones al ESPAÑOL natural.\n"
    "3. Si una fiesta tradicional indica el día y el mes pero no el año, asígnale el año "
    f"{ANIO_ACTUAL} (formato {ANIO_ACTUAL}-MM-DD). Si solo indica el mes, usa {ANIO_ACTUAL}-MM.\n"
    "4. En los posts de Facebook usa la fecha 'Publicado' para resolver expresiones relativas "
    "('este sábado', 'mañana', 'el próximo fin de semana'). Revisa también el texto OCR de las imágenes.\n"
    "5. NO incluyas festivos nacionales genéricos (Año Nuevo, Reyes, 1 de mayo, 12 de octubre, Navidad) "
    "ni eventos de otros municipios.\n"
    "6. Valores permitidos para 'tipo': festivo_local, fiesta_patronal, evento_cultural, evento_deportivo, "
    "concierto_verbena, mercado_feria, otro.\n"
    "7. Valores permitidos para 'origen': web_oficial, red_social, agenda_publica (elige SOLO UNO). "
    "Los posts de Facebook son red_social.\n"
    "8. 'fuente_url' debe ser la URL concreta (post, noticia) de donde sale el evento.\n"
    "Devuelve EXCLUSIVAMENTE un JSON válido con este formato:\n"
    '{"items": [{"titulo": "Nombre del evento", "tipo": "fiesta_patronal", "fecha_inicio": "2026-08-15", '
    '"fecha_fin": null, "hora_inicio": null, "ubicacion": "Lugar", "descripcion": "Detalle del programa", '
    '"origen": "agenda_publica", "fuente_url": "https://..."}]}'
)


def extraer_de_textos(
    config: dict[str, Any], bloques: list[str], router: ProductionLLMRouter
) -> list[EventoFestivo]:
    """Lanza RuntimeError si no queda ningún LLM disponible (el pipeline lo trata como parada controlada)."""
    if not bloques:
        return []
    contexto = "\n\n".join(bloques)[:MAX_CONTEXTO]
    user_prompt = (
        f"Municipio objetivo: {config['nombre_oficial']} ({config['provincia']}, {config['comunidad']}).\n"
        f"Año objetivo: {ANIO_ACTUAL}.\n\n"
        f"CONTENIDO RECOLECTADO:\n{contexto}"
    )
    respuesta = router.generar_json(SYSTEM_PROMPT, user_prompt)

    items = respuesta.get("items", []) if isinstance(respuesta, dict) else []
    eventos: list[EventoFestivo] = []
    for it in items if isinstance(items, list) else []:
        # Validación item a item: un evento mal formado ya no tumba todo el lote.
        try:
            eventos.append(EventoFestivo.model_validate(it))
        except ValidationError as e:
            titulo = it.get("titulo") if isinstance(it, dict) else it
            print(f"    [!] Evento descartado ({titulo!r}): {e.errors()[0]['msg']}")
    return eventos

# ==============================================================================
# 9. ADAPTADOR DE SALIDA PARA PUBLIC.EVENTO (POSTGRESQL / SUPABASE)
# ==============================================================================
# Adaptador de salida para public.evento (PostgreSQL / Supabase).
# Alineado con comarca.js y EventoService.js:
# 1=Turismo, 2=Fiesta Patronal, 3=Gastronomía, 4=Comercio, 5=Deportes, 6=Cultura
MAPA_TIPO_EVENTO: dict[str, int] = {
    "festivo_local": 2,
    "fiesta_patronal": 2,
    "evento_cultural": 6,
    "evento_deportivo": 5,
    "concierto_verbena": 2,
    "mercado_feria": 4,
    "otro": 1,
}

_TZ = ZoneInfo(ZONA_HORARIA)


def _normalizar_timestamp_es(fecha_str: Optional[str], hora_str: Optional[str], es_fin: bool = False) -> str:
    """YYYY-MM o YYYY-MM-DD (+ hora opcional) -> ISO 8601 con el offset real de Madrid
    (+01:00 en invierno, +02:00 en verano; scrapper2 ponía siempre +01:00)."""
    fecha = (fecha_str or "").strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}", fecha):
        fecha_base = fecha[:10]
    elif re.match(r"^\d{4}-\d{2}$", fecha):
        fecha_base = f"{fecha}-01"
    else:
        fecha_base = f"{ANIO_ACTUAL}-01-01"

    hora, minuto = (23, 59) if es_fin else (9, 0)
    if hora_str and re.match(r"^\d{1,2}:\d{2}", hora_str.strip()):
        partes = hora_str.strip().split(":")
        hora, minuto = int(partes[0]) % 24, int(partes[1][:2]) % 60

    try:
        dt = datetime.strptime(fecha_base, "%Y-%m-%d").replace(hour=hora, minute=minuto, tzinfo=_TZ)
    except ValueError:  # p. ej. 2026-02-30
        dt = datetime(ANIO_ACTUAL, 1, 1, hora, minuto, tzinfo=_TZ)
    return dt.isoformat()


def adaptar_a_esquema_bd(
    registros: list[dict[str, Any]],
    negocio_id: int | None = None,
) -> list[dict[str, Any]]:
    if negocio_id is None:
        raw_neg = os.getenv("SCRAPPER_NEGOCIO_ID", "").strip()
        if raw_neg.isdigit():
            negocio_id = int(raw_neg)

    filas_bd: list[dict[str, Any]] = []
    urls_usadas: set[str] = set()

    for idx, reg in enumerate(registros, start=1):
        coords_default = MUNICIPIOS.get(reg.get("municipio_slug", ""), {}).get("coordenadas", "37.1000,-2.3000")

        ubicacion = (reg.get("ubicacion") or "").strip()
        desc = (reg.get("descripcion") or "").strip()
        descripcion_final = f"Ubicación: {ubicacion}. {desc}".strip() if ubicacion else desc

        fecha_ini = _normalizar_timestamp_es(reg.get("fecha_inicio"), reg.get("hora_inicio"), es_fin=False)
        fecha_fin = _normalizar_timestamp_es(reg.get("fecha_fin") or reg.get("fecha_inicio"), None, es_fin=True)

        # Unicidad de url_post (constraint evento_url_post_key)
        url_base = (reg.get("fuente_url") or "").strip() or None
        if url_base and url_base in urls_usadas:
            slug_titulo = re.sub(r"[^a-z0-9]+", "-", reg["titulo"].lower()).strip("-")[:40]
            url_unica = f"{url_base}#{slug_titulo}-{idx}"
        else:
            url_unica = url_base
        if url_unica:
            urls_usadas.add(url_unica)

        origen = reg.get("origen", "web")
        filas_bd.append(
            {
                "nombre": reg["titulo"].strip(),
                "negocio": negocio_id,
                "descripcion": descripcion_final,
                "coordenadas": coords_default,
                "dePago": False,
                "asistentes": 0,
                "aforo": 0,
                "tipoEvento": MAPA_TIPO_EVENTO.get(reg.get("tipo", "otro"), 1),
                "imagen": "",
                "fechaInicio": fecha_ini,
                "fechaFin": fecha_fin,
                "url_post": url_unica,
                "pueblo": reg.get("municipio_nombre"),
                "estado": "pendiente",
                "motivo": f"Extraído automáticamente por scraper ({origen}) · Pendiente de revisión",
            }
        )
    return filas_bd


def subir_a_supabase(filas_bd: list[dict[str, Any]]) -> int:
    """Inserta las filas en public.evento vía REST ignorando duplicados por url_post."""
    if not filas_bd:
        return 0
    supa_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    supa_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.getenv("SUPABASE_KEY", "").strip()
    )
    if not supa_url or not supa_key:
        raise RuntimeError(
            "Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_KEY) en el archivo .env"
        )

    headers = {
        "apikey": supa_key,
        "Authorization": f"Bearer {supa_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=ignore-duplicates,return=representation",
    }
    resp = httpx.post(
        f"{supa_url}/rest/v1/evento?on_conflict=url_post",
        headers=headers,
        json=filas_bd,
        timeout=30.0,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Error Supabase HTTP {resp.status_code}: {resp.text[:300]}")
    insertados = resp.json() if resp.text.strip() else []
    return len(insertados) if isinstance(insertados, list) else 0

# ==============================================================================
# 10. PIPELINE
# ==============================================================================
def _clave_dedup(ev: EventoFestivo) -> tuple[str, str]:
    titulo = unicodedata.normalize("NFKD", ev.titulo.lower())
    titulo = "".join(c for c in titulo if not unicodedata.combining(c))
    titulo = " ".join(titulo.replace("-", " ").split())
    return titulo, ev.fecha_inicio[:10]


def _corregir_origen(ev: EventoFestivo, dominios_oficiales: set[str]) -> EventoFestivo:
    dominio = urlparse(ev.fuente_url).netloc.lower().removeprefix("www.")
    if "facebook.com" in dominio or "instagram.com" in dominio:
        ev.origen = "red_social"
    elif dominio in dominios_oficiales:
        ev.origen = "web_oficial"
    return ev


def procesar_municipio(
    clave: str,
    config: dict[str, Any],
    router_texto: ProductionLLMRouter,
    router_sg: ProductionLLMRouter | None,
    posts_fb: list[dict[str, Any]] | None,
) -> tuple[list[dict[str, Any]], bool]:
    """Devuelve (filas, llm_agotado)."""
    print(f"\n=== [{datetime.now().strftime('%H:%M:%S')}] Procesando {config['nombre_oficial']} ===")
    eventos: list[EventoFestivo] = []
    bloques: list[str] = []
    paginas_ayto: list[str] = config.get("paginas_ayuntamiento", [])
    fb_url = config.get("facebook_url", "")

    # 1. Facebook oficial vía Apify (va primero: es lo más actual y no se recorta)
    if posts_fb:
        bloque_fb = posts_a_bloque(posts_fb, fb_url)
        if bloque_fb:
            print(f"  [Apify] {len(posts_fb)} posts de Facebook para el LLM.")
            bloques.append(bloque_fb)

    # 2. Web del ayuntamiento con ScrapeGraphAI (extrae eventos estructurados directamente)
    paginas_para_clasico: list[str] = list(paginas_ayto)
    if router_sg is not None:
        paginas_para_clasico = []
        for url in paginas_ayto:
            resultado = extraer_eventos_web(url, config, router_sg)
            if resultado is None:
                print(f"  [i] {url} pasa al flujo clásico (httpx + LLM).")
                paginas_para_clasico.append(url)
            else:
                eventos.extend(resultado)

    # 3. Fuentes directas clásicas (andalucia.com, tema La Voz, y webs ayto si ScrapeGraph falló)
    for url in paginas_para_clasico + config.get("urls_directas", []):
        print(f"  Scraping directo -> {url}")
        texto = limpiar_soup(descargar_html(url), max_chars=7500)
        if texto:
            bloques.append(f"--- FUENTE DIRECTA: {url} ---\n{texto}")

    # 4. Noticias de La Voz de Almería
    if config.get("lavoz_tema"):
        bloques.extend(extraer_articulos_lavoz(config["lavoz_tema"], max_articulos=3))

    # 5. Prensa local descubierta en DuckDuckGo
    urls_prensa, snippets = buscar_prensa(config.get("queries_eventos", []))
    for url in urls_prensa[:3]:
        print(f"  Scraping prensa/agenda -> {urlparse(url).netloc}")
        texto = limpiar_soup(descargar_html(url), max_chars=5500)
        if texto:
            bloques.append(f"--- FUENTE PRENSA/AGENDA: {url} ---\n{texto}")

    # 6. Facebook de respaldo (Jina + índices) solo si Apify no trajo nada
    if not posts_fb:
        snippets.extend(facebook_respaldo(fb_url, config.get("facebook_queries", [])))
    if snippets:
        print(f"  Recolectados {len(snippets)} fragmentos indexados.")
        bloques.append("--- FACEBOOK E ÍNDICES PÚBLICOS ---\n" + "\n\n".join(snippets))

    # 7. Extracción LLM sobre todo el texto recolectado
    agotado = False
    try:
        eventos.extend(extraer_de_textos(config, bloques, router_texto))
    except RuntimeError as err:
        print(f"  [PARADA CONTROLADA] {err}")
        agotado = True

    # 8. Normalización, filtro de año y deduplicación entre fuentes
    dominios_oficiales = {urlparse(u).netloc.lower().removeprefix("www.") for u in paginas_ayto}
    salida: list[dict[str, Any]] = []
    vistos: set[tuple[str, str]] = set()
    for ev in eventos:
        if ev.fecha_inicio[:4].isdigit() and int(ev.fecha_inicio[:4]) < ANIO_ACTUAL:
            continue
        huella = _clave_dedup(ev)
        if huella in vistos:
            continue
        vistos.add(huella)
        fila = _corregir_origen(ev, dominios_oficiales).model_dump()
        fila.update(
            municipio_slug=clave,
            municipio_nombre=config["nombre_oficial"],
            provincia=config["provincia"],
            comunidad_autonoma=config["comunidad"],
            actualizado_en=datetime.now().isoformat(),
        )
        salida.append(fila)

    print(f"  [OK] {len(salida)} eventos/fiestas extraídos para {config['nombre_oficial']}.")
    return salida, agotado


def ejecutar_pipeline(
    municipios: list[str] | None = None,
    usar_apify: bool = True,
    usar_scrapegraph: bool = SCRAPEGRAPH_ACTIVO,
    subir_bd: bool = False,
    negocio_id: int | None = None,
) -> Path:
    seleccion = {k: v for k, v in MUNICIPIOS.items() if not municipios or k in municipios}
    router_texto = ProductionLLMRouter()

    router_sg: ProductionLLMRouter | None = None
    if usar_scrapegraph:
        try:
            router_sg = ProductionLLMRouter(orden_raw=SCRAPEGRAPH_ORDEN)
        except RuntimeError as e:
            print(f"[i] ScrapeGraphAI desactivado: {e}")

    # Apify: una sola ejecución para todas las páginas de Facebook
    posts_por_url: dict[str, list[dict[str, Any]]] = {}
    apify = ApifyFacebookFuente()
    if usar_apify and apify.disponible:
        posts_por_url = apify.obtener_posts([c.get("facebook_url", "") for c in seleccion.values()])
    elif usar_apify:
        print("[i] Sin APIFY_TOKEN en el .env: Facebook se lee con el respaldo Jina/DuckDuckGo.")

    acumulado: list[dict[str, Any]] = []
    for clave, config in seleccion.items():
        posts = posts_por_url.get(normalizar_url_facebook(config.get("facebook_url", "")))
        filas, agotado = procesar_municipio(clave, config, router_texto, router_sg, posts)
        acumulado.extend(filas)
        if agotado:
            break

    (DIR_SALIDA / f"eventos_crudos_{ANIO_ACTUAL}.json").write_text(
        json.dumps(acumulado, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    filas_bd = adaptar_a_esquema_bd(acumulado, negocio_id=negocio_id)
    ruta_salida = Path(f"eventos_festivos_{ANIO_ACTUAL}.json")
    ruta_salida.write_text(
        json.dumps(filas_bd, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nGuardado correctamente en {ruta_salida.resolve()} ({len(filas_bd)} eventos)")

    if subir_bd and filas_bd:
        insertados = subir_a_supabase(filas_bd)
        print(f"[Supabase] Insertados {insertados} evento(s) nuevos en public.evento (duplicados omitidos).")

    return ruta_salida


def main() -> None:
    parser = argparse.ArgumentParser(description="Extractor de eventos de pueblos de Almería")
    parser.add_argument("--municipios", help="Lista separada por comas: " + ",".join(MUNICIPIOS))
    parser.add_argument("--sin-apify", action="store_true", help="No usar Apify para Facebook")
    parser.add_argument("--sin-scrapegraph", action="store_true", help="No usar ScrapeGraphAI en la web del ayto")
    parser.add_argument("--subir-supabase", action="store_true", help="Insertar los eventos extraídos en public.evento")
    parser.add_argument("--negocio-id", type=int, default=None, help="ID de negocio a asociar en public.evento")
    args = parser.parse_args()

    municipios = [m.strip() for m in args.municipios.split(",")] if args.municipios else None
    ejecutar_pipeline(
        municipios=municipios,
        usar_apify=not args.sin_apify,
        usar_scrapegraph=SCRAPEGRAPH_ACTIVO and not args.sin_scrapegraph,
        subir_bd=args.subir_supabase,
        negocio_id=args.negocio_id,
    )



if __name__ == "__main__":
    main()
