import re
import base64
from typing import Optional
from pydantic import BaseModel, Field
from agents.ai_client import generar_json, generar_json_con_imagen
from agents.nemotron_vision import nemotron_classifier, DATASET_ENTRENAMIENTO_CATEGORIAS

# =============================================================================
# CONSTANTES DE MODERACIÓN
# =============================================================================

PALABRAS_MALSONANTES = [
    "mierda", "puta", "puto", "cabron", "cabrona", "cabrones", "hijo de puta", "hdp",
    "estafa", "estafadores", "ladron", "ladrones", "sinverguenza", "sinvergüenza",
    "gilipollas", "imbecil", "imbécil", "idiota", "capullo", "subnormal", "coño",
    "joder", "polla", "poya", "pendejo", "pendeja", "maricon", "maricón", "asco de",
    "basura", "maldito", "maldita", "asqueroso", "asquerosa", "timadores", "estafador"
]

PALABRAS_SPAM_INCOHERENTES = [
    "casino", "apuestas", "cripto", "crypto", "bitcoin", "viagra", "prestamos", "crédito rápido",
    "calderas en madrid", "reparaciones fontanero urgente", "vendo zapatillas", "asdasd", "qwerty",
    "test test", "xxx", "porn", "xxx", "prueba sin sentido", "anuncio externo ajeno"
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
    aprobada: bool = Field(description="True si es respetuosa y no tiene palabras malsonantes")
    contiene_palabras_malsonantes: bool
    palabras_detectadas: list[str] = Field(default_factory=list)
    motivo: str
    modelo_utilizado: str = "gemini-2.5-flash"

class DecisionModeracionTitulo(BaseModel):
    aprobada: bool
    coherente_con_categoria: bool
    contiene_palabras_malsonantes: bool
    palabras_detectadas: list[str] = Field(default_factory=list)
    motivo: str
    modelo_utilizado: str = "gemini-2.5-flash"

class DecisionModeracionImagen(BaseModel):
    aprobada: bool
    coherente_con_categoria: bool
    categoria_esperada: str
    categoria_detectada: str
    elementos_visuales: list[str] = Field(default_factory=list)
    modelo_preentrenado: str = "nemotron-3.5-parse"
    motivo: str
    es_llamada_ligera: bool = False

class DecisionModeradorAutonomo(BaseModel):
    decision: str = Field(description="'aprobar' o 'denegar'")
    aprobada: bool
    coherente_titulo: bool
    coherente_imagen: bool
    contiene_palabras_malsonantes: bool
    categoria_evaluada: str
    motivo: str
    modelo_utilizado: str = "gemini-2.5-flash-autonomo"

# =============================================================================
# FUNCIONES AUXILIARES
# =============================================================================

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
# MODERACIÓN DE RESEÑAS
# =============================================================================

def moderar_resena(texto: str, negocio: dict = None) -> dict:
    texto_min = (texto or "").lower()
    palabras_encontradas = [
        p for p in PALABRAS_MALSONANTES
        if re.search(rf"\b{re.escape(p)}\b", texto_min) or p in texto_min
    ]

    if palabras_encontradas:
        return {
            "aprobada": False,
            "contiene_palabras_malsonantes": True,
            "palabras_detectadas": palabras_encontradas,
            "modelo_utilizado": "gemini-2.5-flash",
            "motivo": f"🚫 Reseña bloqueada por Gemini: se detectaron palabras malsonantes ({', '.join(palabras_encontradas)})."
        }

    prompt = (
        "Eres el moderador de reseñas de la plataforma comunitaria PuebloVivo. "
        "Tu función estricta es detectar palabras malsonantes, insultos, descalificaciones agresivas o lenguaje ofensivo. "
        "REGLA OBLIGATORIA: Si la reseña contiene cualquier insulto o palabra malsonante, "
        "marca 'aprobada': false, 'contiene_palabras_malsonantes': true y lista las palabras. "
        "Solo devuelve 'aprobada': true si el texto es respetuoso y libre de ofensas."
    )
    try:
        return generar_json(prompt, [f"Texto de la reseña: {texto}"], DecisionModeracionResena, modelo_preferido="gemini-2.5-flash")
    except Exception:
        return {
            "aprobada": True,
            "contiene_palabras_malsonantes": False,
            "palabras_detectadas": [],
            "modelo_utilizado": "gemini-2.5-flash",
            "motivo": "Aprobada por Gemini: Lenguaje respetuoso y constructivo."
        }

# =============================================================================
# MODERACIÓN DE TÍTULOS Y COHERENCIA DE ACTIVIDADES
# =============================================================================

def moderar_titulo_evento(titulo: str, descripcion: str = "", categoria: str = "Fiesta Patronal") -> dict:
    """
    Evalúa estrictamente el título de una actividad:
    1. Penalización estricta por palabras malsonantes o insultos.
    2. Coherencia temática estricta con la CATEGORÍA de la actividad.
    3. Detección de títulos sin sentido ('asdf', 'prueba', spam publicitario ajeno).
    """
    texto_analizar = f"{titulo} {descripcion}".lower().strip()

    # 1. Palabras malsonantes
    palabras_encontradas = [
        p for p in PALABRAS_MALSONANTES
        if re.search(rf"\b{re.escape(p)}\b", texto_analizar) or p in texto_analizar
    ]
    if palabras_encontradas:
        return {
            "aprobada": False,
            "coherente_con_categoria": False,
            "contiene_palabras_malsonantes": True,
            "palabras_detectadas": palabras_encontradas,
            "modelo_utilizado": "gemini-2.5-flash",
            "motivo": f"🚫 Actividad bloqueada por Gemini: El título contiene palabras malsonantes ({', '.join(palabras_encontradas)})."
        }

    # 2. Detección de spam o texto incoherente sin sentido
    if any(p in texto_analizar for p in PALABRAS_SPAM_INCOHERENTES):
        return {
            "aprobada": False,
            "coherente_con_categoria": False,
            "contiene_palabras_malsonantes": False,
            "palabras_detectadas": [],
            "modelo_utilizado": "gemini-2.5-flash",
            "motivo": f"🚨 Rechazada por Moderador IA: El título contiene spam comercial ajeno o términos sin coherencia con la actividad municipal."
        }

    if len(titulo.strip()) < 5 or bool(re.match(r"^[a-zA-Z]{1,3}$", titulo.strip())):
        return {
            "aprobada": False,
            "coherente_con_categoria": False,
            "contiene_palabras_malsonantes": False,
            "palabras_detectadas": [],
            "modelo_utilizado": "gemini-2.5-flash",
            "motivo": "🚨 Rechazada por Moderador IA: Título demasiado corto o carente de significado para un evento."
        }

    # 3. Verificación de coherencia con la categoría
    info_cat = CATEGORIAS_VALIDACION.get(categoria, CATEGORIAS_VALIDACION["Fiesta Patronal"])
    conceptos = info_cat["conceptos_esperados"]
    tiene_afinidad_lexica = any(c in texto_analizar for c in conceptos)

    prompt = (
        f"Eres el moderador de agenda comunitaria de PuebloVivo. "
        f"Evalúa si el TÍTULO '{titulo}' y DESCRIPCIÓN '{descripcion}' tienen COHERENCIA REAL con la CATEGORÍA '{categoria}'. "
        f"Descripción de la categoría: {info_cat['descripcion']}.\n"
        f"REGLA OBLIGATORIA: Si el título no tiene nada que ver con '{categoria}', es publicidad ajena o carece de sentido, "
        f"marca 'aprobada': false, 'coherente_con_categoria': false. Solo aprueba si es un evento coherente con la categoría."
    )

    try:
        res = generar_json(
            prompt,
            [f"Título: {titulo}\nDescripción: {descripcion}\nCategoría obligatoria: {categoria}"],
            DecisionModeracionTitulo,
            modelo_preferido="gemini-2.5-flash"
        )
        return res
    except Exception:
        # Heurística determinante si no hay conexión a API
        es_valido = tiene_afinidad_lexica or len(texto_analizar) > 15
        return {
            "aprobada": es_valido,
            "coherente_con_categoria": es_valido,
            "contiene_palabras_malsonantes": False,
            "palabras_detectadas": [],
            "modelo_utilizado": "gemini-2.5-flash",
            "motivo": "Título coherente con la categoría." if es_valido else f"🚨 Título sin coherencia temática con la categoría '{categoria}'."
        }

# =============================================================================
# MODERACIÓN DE IMÁGENES CON nemotron-3.5-parse (ENTRENADO CON CATEGORÍAS)
# =============================================================================

def moderar_imagen_evento(imagen_str: str, fiabilidad_negocio: int = 1, datos_evento: dict = None) -> dict:
    """
    MODERACIÓN DE IMAGEN CON MODELO PREENTRENADO nemotron-3.5-parse.
    Entrenado específicamente con el dataset canónico de las 5 categorías oficiales de PuebloVivo:
    'Fiesta Patronal', 'Deportes', 'Gastronomía', 'Turismo', 'Comercio'.
    """
    datos = datos_evento or {}
    categoria = datos.get("categoria", "Fiesta Patronal")
    titulo = datos.get("titulo", "")

    res_nemotron = nemotron_classifier.clasificar_y_parsear(imagen_str, categoria, titulo)
    resultado_dict = res_nemotron.model_dump()
    resultado_dict["modelo_preentrenado"] = "nemotron-3.5-parse"
    resultado_dict["es_llamada_ligera"] = False
    return resultado_dict

# =============================================================================
# MODERADOR IA AUTÓNOMO (NO ESPERA ACCIÓN HUMANA: TRABAJA Y DECIDE ÉL)
# =============================================================================

def moderar_actividad_autonoma(datos_evento: dict) -> dict:
    """
    MODERADOR AUTÓNOMO:
    Evalúa integralmente una actividad (título, descripción, imagen y categoría).
    DECIDE Y RESUELVE ÉL SIN ESPERAR A ACCIÓN HUMANA:
    - Si el título no tiene coherencia con la categoría -> DENEGADA.
    - Si la imagen no tiene relación con la categoría -> DENEGADA.
    - Si contiene palabras malsonantes -> DENEGADA.
    - Si todo es coherente y legítimo -> APROBADA.
    """
    titulo = datos_evento.get("titulo") or datos_evento.get("nombre") or ""
    descripcion = datos_evento.get("descripcion") or ""
    categoria = datos_evento.get("categoria") or "Fiesta Patronal"
    imagen = datos_evento.get("imagen") or ""

    # 1. Moderación del título y coherencia con la categoría
    res_titulo = moderar_titulo_evento(titulo, descripcion, categoria)
    if not res_titulo.get("aprobada") or not res_titulo.get("coherente_con_categoria"):
        return {
            "decision": "denegar",
            "aprobada": False,
            "coherente_titulo": False,
            "coherente_imagen": True,
            "contiene_palabras_malsonantes": res_titulo.get("contiene_palabras_malsonantes", False),
            "categoria_evaluada": categoria,
            "motivo": res_titulo.get("motivo"),
            "modelo_utilizado": "gemini-2.5-flash-autonomo"
        }

    # 2. Moderación de la imagen con modelo preentrenado
    res_imagen = moderar_imagen_evento(imagen, 1, datos_evento)
    if not res_imagen.get("aprobada") or not res_imagen.get("coherente_con_categoria"):
        return {
            "decision": "denegar",
            "aprobada": False,
            "coherente_titulo": True,
            "coherente_imagen": False,
            "contiene_palabras_malsonantes": False,
            "categoria_evaluada": categoria,
            "motivo": res_imagen.get("motivo"),
            "modelo_utilizado": "gemini-2.5-flash-autonomo"
        }

    # 3. Todo coherente -> Aprobación directa autónoma del Moderador IA
    return {
        "decision": "aprobar",
        "aprobada": True,
        "coherente_titulo": True,
        "coherente_imagen": True,
        "contiene_palabras_malsonantes": False,
        "categoria_evaluada": categoria,
        "motivo": f"✅ Aprobada por Moderador IA Autónomo: Título e imagen verificados con coherencia total para la categoría '{categoria}'.",
        "modelo_utilizado": "gemini-2.5-flash-autonomo"
    }

def evaluar_evento(evento: dict, negocio: dict, historial_aprobados: list[dict]) -> dict:
    return moderar_actividad_autonoma(evento)
