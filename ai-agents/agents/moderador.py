import os
import re
import json
import base64
import logging
import unicodedata
import urllib.request
from typing import Optional
from pydantic import BaseModel, Field
from agents.ai_client import generar_json, generar_json_con_imagen
from agents.nemotron_vision import nemotron_classifier, DATASET_ENTRENAMIENTO_CATEGORIAS

logger = logging.getLogger(__name__)

# =============================================================================
# CONSTANTES DE MODERACIÓN AMPLIADAS (INSULTOS, VIOLENCIA, AMENAZAS, ODIO Y SPAM)
# =============================================================================

PALABRAS_AMENAZAS_VIOLENCIA = [
    # Amenazas directas y agresiones físicas
    "te voy a matar", "os voy a matar", "vamos a matarlos", "matar", "matarte", "matarlo",
    "te mato", "os mato", "muerte a", "ojala te mueras", "ojalá te mueras", "muérete", "muerete",
    "te voy a reventar", "os voy a reventar", "reventar la cabeza", "partir la cara",
    "te parto la cara", "romper las piernas", "dar una paliza", "os vamos a pegar",
    "te voy a pegar", "apuñalar", "acuchillar", "disparar", "pegar un tiro", "tiroteo",
    "quemar el local", "prender fuego", "quemar el coche", "destrozar el negocio",
    "poner una bomba", "atentado", "explosivo", "secuestrar", "ahorcar", "linchar", "linchamiento",
    "violacion", "violación", "violar", "abusar de", "agredir", "agresión",
    # Armas e incitación al odio / violencia colectiva
    "pistola", "escopeta", "navaja", "cuchillo", "machete", "granada", "munición",
    "a por ellos", "hay que quemarlos", "fuera del pueblo", "escoria", "subhumanos",
    "nazi", "terrorista", "terrorismo", "suicidio", "suicidate", "suicídate", "cortate las venas"
]

PALABRAS_MALSONANTES = [
    "mierda", "puta", "puto", "putas", "putos", "cabron", "cabrona", "cabrones",
    "hijo de puta", "hija de puta", "hdp", "hijoputa", "estafa", "estafadores", "estafador",
    "ladron", "ladrones", "ladrón", "sinverguenza", "sinvergüenza", "gilipollas",
    "imbecil", "imbécil", "idiota", "idiotas", "capullo", "capullos", "subnormal",
    "retrasado", "retrasada", "mongolo", "mongola", "coño", "joder", "polla", "poya",
    "pendejo", "pendeja", "maricon", "maricón", "marica", "bollera", "zorra", "perra",
    "malnacido", "malparido", "bastardo", "cretino", "payaso", "inutil", "inútil",
    "asco de", "basura", "maldito", "maldita", "asqueroso", "asquerosa", "timadores",
    "chorizos", "corruptos", "gentuza", "chusma", "rata", "ratas", "cerdo", "cerda"
]

PALABRAS_SPAM_INCOHERENTES = [
    "casino", "apuestas", "cripto", "crypto", "bitcoin", "ethereum", "trading", "forex",
    "viagra", "cialis", "prestamos", "préstamos", "crédito rápido", "dinero fácil",
    "calderas en madrid", "reparaciones fontanero urgente", "vendo zapatillas", "vendo coche",
    "asdasd", "qwerty", "test test", "xxx", "porn", "porno", "onlyfans", "escort",
    "prueba sin sentido", "anuncio externo ajeno", "gana dinero desde casa", "hazte rico"
]

CATEGORIAS_VALIDACION = {
    "Fiesta Patronal": {
        "descripcion": "Celebraciones populares, música, verbenas, procesiones, bailes y actos festivos municipales.",
        "conceptos_esperados": ["verbena", "orquesta", "fiesta", "procesión", "música", "baile", "plaza", "fuegos", "patrón", "patrona", "san", "virgen", "romería", "cohetes", "roscos", "peña", "pregón"],
        "etiquetas": ["Celebración Pública", "Ambiente Festivo", "Concurrencia Popular"]
    },
    "Deportes": {
        "descripcion": "Eventos deportivos, senderismo, carreras de montaña, ciclismo BTT, pistas municipales y trofeos.",
        "conceptos_esperados": ["deporte", "carrera", "senderismo", "bici", "ciclismo", "fútbol", "montaña", "trofeo", "ruta", "pádel", "maratón", "trail", "marcha", "liga", "entrenamiento", "fitness"],
        "etiquetas": ["Actividad Física", "Equipamiento Deportivo", "Aire Libre"]
    },
    "Gastronomía": {
        "descripcion": "Rutas de la tapa, platos tradicionales, repostería, catas y restauración local.",
        "conceptos_esperados": ["tapa", "comida", "plato", "degustación", "restaurante", "vino", "paella", "gastronomía", "dulce", "migas", "aceite", "embutidos", "cata", "puchero", "jamón", "menú", "cena", "almuerzo"],
        "etiquetas": ["Alimentos y Bebidas", "Cocina Tradicional", "Hostelería"]
    },
    "Turismo": {
        "descripcion": "Visitas guiadas, monumentos históricos, paisajes naturales, vías verdes y patrimonio rural.",
        "conceptos_esperados": ["visita", "monumento", "mina", "vía verde", "paisaje", "patrimonio", "historia", "naturaleza", "mirador", "hornos", "sendero", "guía", "excursión", "paraje", "histórico", "ruta turística"],
        "etiquetas": ["Patrimonio Cultural", "Puntos de Interés", "Paisaje Rural"]
    },
    "Comercio": {
        "descripcion": "Mercadillos artesanos, productos de la huerta, tiendas de proximidad y talleres locales.",
        "conceptos_esperados": ["comercio", "tienda", "mercado", "artesanía", "taller", "producto local", "alfarería", "oferta", "esparto", "cerámica", "mercadillo", "huerta", "venta", "artesanal"],
        "etiquetas": ["Comercio Local", "Productos Autóctonos", "Artesanía"]
    }
}

# =============================================================================
# MODELOS PYDANTIC
# =============================================================================

class DecisionModeracionResena(BaseModel):
    aprobada: bool = Field(description="True si es respetuosa y no tiene palabras malsonantes, amenazas ni violencia")
    contiene_palabras_malsonantes: bool
    contiene_amenazas_o_violencia: bool = Field(default=False)
    palabras_detectadas: list[str] = Field(default_factory=list)
    motivo: str
    modelo_utilizado: str = "openrouter-router"

class DecisionModeracionTitulo(BaseModel):
    aprobada: bool
    coherente_con_categoria: bool
    contiene_palabras_malsonantes: bool
    contiene_amenazas_o_violencia: bool = Field(default=False)
    palabras_detectadas: list[str] = Field(default_factory=list)
    motivo: str
    modelo_utilizado: str = "openrouter-router"

class DecisionModeracionImagen(BaseModel):
    aprobada: bool
    coherente_con_categoria: bool
    categoria_esperada: str
    categoria_detectada: str
    elementos_visuales: list[str] = Field(default_factory=list)
    modelo_preentrenado: str = "nvidia/llama-3.1-nemotron-nano-vl-8b-v1"
    motivo: str
    es_llamada_ligera: bool = False

class DecisionModeradorAutonomo(BaseModel):
    decision: str = Field(description="'aprobar', 'denegar' o 'pendiente'")
    aprobada: bool
    coherente_titulo: bool
    coherente_imagen: bool
    contiene_palabras_malsonantes: bool
    categoria_evaluada: str
    motivo: str
    modelo_utilizado: str = "openrouter-router"

# =============================================================================
# ENRUTADOR DE TEXTO CON OPENROUTER (FAILOVER AUTOMÁTICO SI SE CAE O SIN TOKENS)
# =============================================================================

def _normalizar_texto(texto: str) -> str:
    if not texto:
        return ""
    nfd = unicodedata.normalize("NFD", texto.lower())
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn")


def _buscar_terminos_prohibidos(texto: str, lista_terminos: list[str]) -> list[str]:
    """Detecta términos prohibidos incluso con o sin tildes."""
    if not texto:
        return []
    texto_min = texto.lower()
    texto_norm = _normalizar_texto(texto)
    encontrados = []

    for termino in lista_terminos:
        t_min = termino.lower()
        t_norm = _normalizar_texto(termino)
        if (
            re.search(rf"\b{re.escape(t_min)}\b", texto_min)
            or re.search(rf"\b{re.escape(t_norm)}\b", texto_norm)
            or (len(t_min) >= 6 and (t_min in texto_min or t_norm in texto_norm))
        ):
            encontrados.append(termino)
    return list(dict.fromkeys(encontrados))


def _llamar_texto_con_openrouter_failover(
    system_prompt: str,
    user_content: str,
    esquema_cls: type[BaseModel],
    modelo_nativo_preferido: str = "gemini-2.5-flash"
) -> dict:
    """
    Intenta primero el cliente nativo y, si falla, da rate-limit (429) o se agotan tokens,
    salta en cascada por los modelos de OpenRouter automáticamente.
    """
    # 1. Intento con cliente nativo existente (si está disponible y con cuota)
    try:
        res_nativo = generar_json(
            system_prompt,
            [user_content],
            esquema_cls,
            modelo_preferido=modelo_nativo_preferido
        )
        if isinstance(res_nativo, dict) and res_nativo:
            return res_nativo
    except Exception as e:
        logger.warning(f"Cliente nativo ({modelo_nativo_preferido}) falló o agotó tokens, saltando a OpenRouter: {e}")

    # 2. Cadena de respaldo en OpenRouter
    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not openrouter_key:
        raise RuntimeError("Fallo en cliente nativo y no hay OPENROUTER_API_KEY configurada.")

    modelos_openrouter = [
        "google/gemini-2.5-flash",
        "meta-llama/llama-3.3-70b-instruct",
        "nvidia/llama-3.1-nemotron-70b-instruct",
        "qwen/qwen-2.5-72b-instruct"
    ]

    esquema_campos = list(esquema_cls.model_fields.keys())
    instruccion_json = (
        f"{system_prompt}\n\n"
        f"DEVUELVE ÚNICAMENTE UN JSON VÁLIDO (sin bloques markdown ```json) con exactamente estas claves: "
        f"{', '.join(esquema_campos)}."
    )

    ultimo_error = None
    for modelo_or in modelos_openrouter:
        try:
            payload = {
                "model": modelo_or,
                "messages": [
                    {"role": "system", "content": instruccion_json},
                    {"role": "user", "content": user_content}
                ],
                "temperature": 0.1,
                "max_tokens": 500
            }

            req = urllib.request.Request(
                "[https://openrouter.ai/api/v1/chat/completions](https://openrouter.ai/api/v1/chat/completions)",
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {openrouter_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "[https://pueblovivo.local](https://pueblovivo.local)",
                    "X-Title": "PuebloVivo-Moderador"
                },
                method="POST"
            )

            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                raw_text = data["choices"][0]["message"]["content"]
                clean_text = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_text.strip())
                parsed = json.loads(clean_text)
                parsed["modelo_utilizado"] = f"openrouter/{modelo_or}"
                # Validar con Pydantic para garantizar estructura
                return esquema_cls(**parsed).model_dump()

        except Exception as e:
            ultimo_error = e
            logger.warning(f"OpenRouter modelo {modelo_or} falló o sin tokens, probando siguiente: {e}")

    raise RuntimeError(f"Todos los modelos de OpenRouter fallaron: {ultimo_error}")


def extraer_bytes_imagen(imagen_str: str) -> tuple[Optional[bytes], str]:
    if not imagen_str:
        return None, "image/jpeg"
    mime = "image/jpeg"
    if "base64," in imagen_str:
        partes = imagen_str.split("base64,")
        header = partes[0]
        if "data:" in header and ";" in header:
            mime = header.replace("data:", "").replace(";", "").strip()
        data_base64 = partes[1]
    else:
        data_base64 = imagen_str

    try:
        raw_bytes = base64.b64decode(data_base64)
        return raw_bytes, mime
    except Exception:
        return None, mime

# =============================================================================
# MODERACIÓN DE RESEÑAS (CON DETECCIÓN DE AMENAZAS, VIOLENCIA E INSULTOS)
# =============================================================================

def moderar_resena(texto: str, negocio: dict = None) -> dict:
    # 1. Filtro inmediato de amenazas e incitación a la violencia
    amenazas_encontradas = _buscar_terminos_prohibidos(texto, PALABRAS_AMENAZAS_VIOLENCIA)
    if amenazas_encontradas:
        return {
            "aprobada": False,
            "contiene_palabras_malsonantes": True,
            "contiene_amenazas_o_violencia": True,
            "palabras_detectadas": amenazas_encontradas,
            "modelo_utilizado": "filtro-seguridad-critico",
            "motivo": f"🚨 Reseña bloqueada por seguridad: Se detectaron amenazas o incitación a la violencia ({', '.join(amenazas_encontradas)})."
        }

    # 2. Filtro inmediato de palabras malsonantes
    palabras_encontradas = _buscar_terminos_prohibidos(texto, PALABRAS_MALSONANTES)
    if palabras_encontradas:
        return {
            "aprobada": False,
            "contiene_palabras_malsonantes": True,
            "contiene_amenazas_o_violencia": False,
            "palabras_detectadas": palabras_encontradas,
            "modelo_utilizado": "filtro-lexico",
            "motivo": f"🚫 Reseña bloqueada: se detectaron palabras malsonantes ({', '.join(palabras_encontradas)})."
        }

    # 3. Evaluación semántica con OpenRouter Failover (detecta amenazas veladas, acoso o odio sin palabras literales)
    prompt = (
        "Eres el moderador de seguridad y convivencia de la plataforma comunitaria PuebloVivo. "
        "Tu función estricta es detectar:\n"
        "1. Amenazas directas o veladas, intimidación, incitación a la violencia, agresiones físicas, daños a locales o discurso de odio.\n"
        "2. Palabras malsonantes, insultos, vejaciones o difamación agresiva.\n"
        "REGLA OBLIGATORIA: Si la reseña contiene CUALQUIER amenaza, incitación a la violencia, acoso o insulto, "
        "marca 'aprobada': false, 'contiene_amenazas_o_violencia' o 'contiene_palabras_malsonantes': true y explica el motivo. "
        "Solo devuelve 'aprobada': true si la crítica o comentario es respetuoso y pacífico."
    )
    try:
        return _llamar_texto_con_openrouter_failover(
            system_prompt=prompt,
            user_content=f"Texto de la reseña: {texto}",
            esquema_cls=DecisionModeracionResena
        )
    except Exception:
        return {
            "aprobada": True,
            "contiene_palabras_malsonantes": False,
            "contiene_amenazas_o_violencia": False,
            "palabras_detectadas": [],
            "modelo_utilizado": "fallback-local",
            "motivo": "Aprobada tras verificación léxica: Lenguaje respetuoso y sin amenazas."
        }

# =============================================================================
# MODERACIÓN DE TÍTULOS Y COHERENCIA DE ACTIVIDADES
# =============================================================================

def moderar_titulo_evento(titulo: str, descripcion: str = "", categoria: str = "Fiesta Patronal") -> dict:
    texto_completo = f"{titulo} {descripcion}".strip()
    texto_analizar = texto_completo.lower()

    # 1. Tolerancia cero ante amenazas e incitación a la violencia
    amenazas_encontradas = _buscar_terminos_prohibidos(texto_completo, PALABRAS_AMENAZAS_VIOLENCIA)
    if amenazas_encontradas:
        return {
            "aprobada": False,
            "coherente_con_categoria": False,
            "contiene_palabras_malsonantes": True,
            "contiene_amenazas_o_violencia": True,
            "palabras_detectadas": amenazas_encontradas,
            "modelo_utilizado": "filtro-seguridad-critico",
            "motivo": f"🚨 Actividad bloqueada por seguridad: Contiene amenazas o incitación a la violencia ({', '.join(amenazas_encontradas)})."
        }

    # 2. Palabras malsonantes
    palabras_encontradas = _buscar_terminos_prohibidos(texto_completo, PALABRAS_MALSONANTES)
    if palabras_encontradas:
        return {
            "aprobada": False,
            "coherente_con_categoria": False,
            "contiene_palabras_malsonantes": True,
            "contiene_amenazas_o_violencia": False,
            "palabras_detectadas": palabras_encontradas,
            "modelo_utilizado": "filtro-lexico",
            "motivo": f"🚫 Actividad bloqueada: El texto contiene palabras malsonantes ({', '.join(palabras_encontradas)})."
        }

    # 3. Detección de spam o texto incoherente sin sentido
    spam_encontrado = _buscar_terminos_prohibidos(texto_completo, PALABRAS_SPAM_INCOHERENTES)
    if spam_encontrado:
        return {
            "aprobada": False,
            "coherente_con_categoria": False,
            "contiene_palabras_malsonantes": False,
            "contiene_amenazas_o_violencia": False,
            "palabras_detectadas": spam_encontrado,
            "modelo_utilizado": "filtro-spam",
            "motivo": "🚨 Rechazada por Moderador IA: Contiene spam comercial ajeno o términos sin coherencia con la actividad municipal."
        }

    if len(titulo.strip()) < 5 or bool(re.match(r"^[a-zA-Z]{1,3}$", titulo.strip())):
        return {
            "aprobada": False,
            "coherente_con_categoria": False,
            "contiene_palabras_malsonantes": False,
            "contiene_amenazas_o_violencia": False,
            "palabras_detectadas": [],
            "modelo_utilizado": "filtro-longitud",
            "motivo": "🚨 Rechazada por Moderador IA: Título demasiado corto o carente de significado para un evento."
        }

    # 4. Verificación semántica de seguridad y coherencia con la categoría (con OpenRouter Failover)
    info_cat = CATEGORIAS_VALIDACION.get(categoria, CATEGORIAS_VALIDACION["Fiesta Patronal"])
    conceptos = info_cat["conceptos_esperados"]
    tiene_afinidad_lexica = any(c in texto_analizar for c in conceptos)

    prompt = (
        f"Eres el moderador de agenda comunitaria y seguridad de PuebloVivo.\n"
        f"Evalúa el TÍTULO '{titulo}' y DESCRIPCIÓN '{descripcion}' para la CATEGORÍA '{categoria}' ({info_cat['descripcion']}).\n"
        f"REGLAS OBLIGATORIAS:\n"
        f"1. Si el texto incita a la violencia, contiene amenazas, acoso, odio o convocatorias peligrosas, marca 'aprobada': false y 'contiene_amenazas_o_violencia': true.\n"
        f"2. Si el título/descripción no tiene relación real con '{categoria}', es spam ajeno o carece de sentido, marca 'aprobada': false y 'coherente_con_categoria': false.\n"
        f"3. Solo aprueba si es un evento pacífico, legítimo y coherente con '{categoria}'."
    )

    try:
        return _llamar_texto_con_openrouter_failover(
            system_prompt=prompt,
            user_content=f"Título: {titulo}\nDescripción: {descripcion}\nCategoría obligatoria: {categoria}",
            esquema_cls=DecisionModeracionTitulo
        )
    except Exception:
        es_valido = tiene_afinidad_lexica or len(texto_analizar) > 15
        return {
            "aprobada": es_valido,
            "coherente_con_categoria": es_valido,
            "contiene_palabras_malsonantes": False,
            "contiene_amenazas_o_violencia": False,
            "palabras_detectadas": [],
            "modelo_utilizado": "fallback-local",
            "motivo": "Título coherente con la categoría." if es_valido else f"🚨 Título sin coherencia temática con la categoría '{categoria}'."
        }

# =============================================================================
# MODERACIÓN DE IMÁGENES CON NVIDIA NIM + OPENROUTER FAILOVER
# =============================================================================

def moderar_imagen_evento(imagen_str: str, fiabilidad_negocio: int = 1, datos_evento: dict = None) -> dict:
    """
    MODERACIÓN DE IMAGEN CON NVIDIA NIM + OPENROUTER FAILOVER:
    - fiabilidad_negocio == 1: Estricto (ref 1).
    - fiabilidad_negocio >= 3: Excepción flexible para negocios verificados (ref 3).
    """
    datos = datos_evento or {}
    categoria = datos.get("categoria", "Fiesta Patronal")
    titulo = datos.get("titulo") or datos.get("nombre") or ""

    res_nemotron = nemotron_classifier.clasificar_y_parsear(
        imagen_str=imagen_str,
        categoria_esperada=categoria,
        titulo_evento=titulo,
        fiabilidad_negocio=fiabilidad_negocio
    )
    resultado_dict = res_nemotron.model_dump()
    resultado_dict["modelo_preentrenado"] = res_nemotron.modelo
    resultado_dict["es_llamada_ligera"] = False
    return resultado_dict

# =============================================================================
# MODERADOR IA HÍBRIDO (APRUEBA, DENIEGA O ENVÍA A PENDIENTES DEL MODERADOR)
# =============================================================================

def moderar_actividad_autonoma(datos_evento: dict, fiabilidad_negocio: int = 1) -> dict:
    titulo = datos_evento.get("titulo") or datos_evento.get("nombre") or ""
    descripcion = datos_evento.get("descripcion") or ""
    categoria = datos_evento.get("categoria") or "Fiesta Patronal"
    imagen = datos_evento.get("imagen") or ""

    fiabilidad = int(datos_evento.get("fiabilidad_negocio", fiabilidad_negocio))

    # 1. Moderación del título y descripción
    res_titulo = moderar_titulo_evento(titulo, descripcion, categoria)
    tiene_amenazas = res_titulo.get("contiene_amenazas_o_violencia", False)
    tiene_insultos = res_titulo.get("contiene_palabras_malsonantes", False)

    if not res_titulo.get("aprobada") or not res_titulo.get("coherente_con_categoria"):
        # Excepción Ref. 3: NUNCA se aplica si hay amenazas, violencia o insultos.
        # Solo aplica si el título era algo genérico pero limpio.
        if (
            fiabilidad >= 3
            and not tiene_amenazas
            and not tiene_insultos
            and len(titulo.strip()) >= 5
        ):
            pass
        else:
            return {
                "decision": "denegar",
                "estado_moderacion": "RECHAZADO",
                "aprobada": False,
                "requiere_revision_humana": False,
                "coherente_titulo": False,
                "coherente_imagen": True,
                "contiene_palabras_malsonantes": tiene_insultos or tiene_amenazas,
                "categoria_evaluada": categoria,
                "motivo": res_titulo.get("motivo"),
                "modelo_utilizado": res_titulo.get("modelo_utilizado", "openrouter-router")
            }

    # 2. Moderación de la imagen con NVIDIA NIM + OpenRouter Failover
    res_imagen = moderar_imagen_evento(imagen, fiabilidad, datos_evento)
    estado_img = res_imagen.get("estado_moderacion", "RECHAZADO")

    # 2A. Zona de duda -> Panel del moderador (Pendientes)
    if estado_img == "PENDIENTE_MODERADOR" or res_imagen.get("requiere_revision_humana"):
        return {
            "decision": "pendiente",
            "estado_moderacion": "PENDIENTE_MODERADOR",
            "aprobada": False,
            "requiere_revision_humana": True,
            "coherente_titulo": True,
            "coherente_imagen": False,
            "contiene_palabras_malsonantes": False,
            "categoria_evaluada": categoria,
            "sugerencia_categoria": res_imagen.get("sugerencia_categoria_alternativa"),
            "motivo": res_imagen.get("motivo"),
            "modelo_utilizado": res_imagen.get("modelo", "openrouter-vision")
        }

    # 2B. Rechazo claro
    if not res_imagen.get("aprobada") or not res_imagen.get("coherente_con_categoria"):
        return {
            "decision": "denegar",
            "estado_moderacion": "RECHAZADO",
            "aprobada": False,
            "requiere_revision_humana": False,
            "coherente_titulo": True,
            "coherente_imagen": False,
            "contiene_palabras_malsonantes": res_imagen.get("contiene_contenido_violento_o_peligroso", False),
            "categoria_evaluada": categoria,
            "sugerencia_categoria": res_imagen.get("sugerencia_categoria_alternativa"),
            "motivo": res_imagen.get("motivo"),
            "modelo_utilizado": res_imagen.get("modelo", "openrouter-vision")
        }

    # 3. Aprobación directa
    return {
        "decision": "aprobar",
        "estado_moderacion": "APROBADO",
        "aprobada": True,
        "requiere_revision_humana": False,
        "coherente_titulo": True,
        "coherente_imagen": True,
        "contiene_palabras_malsonantes": False,
        "categoria_evaluada": categoria,
        "motivo": res_imagen.get("motivo"),
        "modelo_utilizado": f"{res_titulo.get('modelo_utilizado', 'texto')} + {res_imagen.get('modelo', 'vision')}"
    }


def evaluar_evento(evento: dict, negocio: dict, historial_aprobados: list[dict]) -> dict:
    fiabilidad = 1
    if isinstance(negocio, dict):
        fiabilidad = int(negocio.get("fiabilidad", negocio.get("nivel_fiabilidad", 1)))
    return moderar_actividad_autonoma(evento, fiabilidad_negocio=fiabilidad)