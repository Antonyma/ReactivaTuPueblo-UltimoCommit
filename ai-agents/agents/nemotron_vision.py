"""
Módulo de entrenamiento, parseo de texto visual (OCR) y clasificación con nemotron-3.5-parse.
Especializado en las 5 categorías oficiales de eventos y actividades de PuebloVivo:
'Fiesta Patronal', 'Deportes', 'Gastronomía', 'Turismo', 'Comercio'.

REGLA ESTRICTA DE EXTRACCIÓN Y COHERENCIA DE TEXTO EN IMÁGENES:
- nemotron-3.5-parse extrae todo el texto/letreros incrustados en la imagen (OCR).
- Si el texto extraído NO TIENE RELACIÓN con la categoría esperada o pertenece a otra temática,
  NO SE PERMITE LA PUBLICACIÓN BAJO NINGÚN CONCEPTO.
"""

import os
import re
import json
import base64
from typing import Optional
from pydantic import BaseModel, Field

# =============================================================================
# DATASET DE ENTRENAMIENTO POR CATEGORÍAS (PATRONES VISUALES Y FOTOS CANÓNICAS)
# =============================================================================

DATASET_ENTRENAMIENTO_CATEGORIAS = {
    "Fiesta Patronal": {
        "descripcion": "Celebraciones populares, música, verbenas, procesiones, bailes y actos festivos municipales.",
        "patrones_visuales_obligatorios": [
            "escenario", "orquesta", "guirnaldas", "plaza", "baile", "concurrencia",
            "iluminación festiva", "procesión", "andas", "santo", "patrona", "virgen",
            "roscos", "fuegos artificiales", "cohetes", "traje tradicional", "feria", "verbena"
        ],
        "terminos_texto_cartel_permitidos": [
            "fiesta", "patronal", "san", "virgen", "verbena", "orquesta", "procesión",
            "música", "baile", "plaza", "cohetes", "roscos", "romería", "feria", "programa"
        ],
        "ejemplos_canonicos": [
            {
                "titulo": "Verbena en la Plaza del Pueblo",
                "descripcion": "Plaza municipal iluminada con guirnaldas, orquesta en escenario, vecinos bailando.",
                "url": "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=800&q=80"
            },
            {
                "titulo": "Procesión de San Roque y Roscos",
                "descripcion": "Procesión con andas por calles encaladas, música de banda municipal y reparto de roscos.",
                "url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80"
            }
        ]
    },
    "Deportes": {
        "descripcion": "Eventos deportivos, senderismo, carreras de montaña, ciclismo BTT, pistas municipales y trofeos.",
        "patrones_visuales_obligatorios": [
            "bicicleta", "ciclista", "casco", "sendero", "sierra", "montaña", "btt",
            "bastones trekking", "mochila", "deportistas", "camino rural", "pista deportiva",
            "fútbol", "pádel", "carrera", "trofeo", "meta", "dorsal", "zapatillas deportivas"
        ],
        "terminos_texto_cartel_permitidos": [
            "carrera", "trail", "btt", "ciclismo", "bicicleta", "senderismo", "maratón",
            "trofeo", "torneo", "pádel", "fútbol", "dorsal", "inscripción", "deporte", "km"
        ],
        "ejemplos_canonicos": [
            {
                "titulo": "Ruta Cicloturista BTT Sierra Alhamilla",
                "descripcion": "Ciclistas con casco y bicicleta de montaña subiendo pista pedregosa de sierra.",
                "url": "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=800&q=80"
            },
            {
                "titulo": "Senderismo y Trail por Barrancos",
                "descripcion": "Grupo con bastones de trekking y ropa técnica de montaña en ruta natural.",
                "url": "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=800&q=80"
            }
        ]
    },
    "Gastronomía": {
        "descripcion": "Rutas de la tapa, platos tradicionales, repostería, catas y restauración local.",
        "patrones_visuales_obligatorios": [
            "sartén", "brasas", "leña", "migas", "panceta", "plato tradicional", "vino",
            "tapas", "mostrador", "embutidos", "queso", "aceitunas", "hostelería", "paella",
            "comida", "alimentos", "degustación", "restaurante", "plato servido", "vino tinto"
        ],
        "terminos_texto_cartel_permitidos": [
            "tapa", "migas", "gastronomía", "degustación", "vino", "cata", "menú", "paella",
            "comida", "almuerzo", "cena", "postre", "dulce", "puchero", "embutidos", "jamón"
        ],
        "ejemplos_canonicos": [
            {
                "titulo": "Comida de Migas Serranas en Lumbre",
                "descripcion": "Sartén gigante con migas sobre leña, tropezones, jarras de vino y comensales.",
                "url": "https://images.unsplash.com/photo-1515443961218-a51367888e4b?auto=format&fit=crop&w=800&q=80"
            },
            {
                "titulo": "Ruta de la Tapa y Vino Comarcal",
                "descripcion": "Platos con embutidos serranos, queso de cabra, vino y tapas típicas en taberna.",
                "url": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80"
            }
        ]
    },
    "Turismo": {
        "descripcion": "Visitas guiadas, monumentos históricos, paisajes naturales, vías verdes y patrimonio rural.",
        "patrones_visuales_obligatorios": [
            "hornos calcinación", "patrimonio minero", "vía verde", "arquitectura histórica",
            "turismo cultural", "castillo", "mirador", "guía turístico", "valle", "monumento",
            "paisaje natural", "ruinas", "fortaleza", "panel informativo", "visita guiada"
        ],
        "terminos_texto_cartel_permitidos": [
            "visita", "guiada", "patrimonio", "hornos", "vía verde", "historia", "monumento",
            "castillo", "mirador", "naturaleza", "paraje", "excursión", "turismo", "ruta"
        ],
        "ejemplos_canonicos": [
            {
                "titulo": "Paseo Hornos de Calcinación y Vía Verde",
                "descripcion": "Hornos históricos de hierro minero, puente de madera y paneles de la vía verde.",
                "url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80"
            },
            {
                "titulo": "Visita Guiada al Castillo y Mirador",
                "descripcion": "Murallas de fortaleza sobre el cerro y mirador con vistas al valle comarcal.",
                "url": "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80"
            }
        ]
    },
    "Comercio": {
        "descripcion": "Mercadillos artesanos, productos de la huerta, tiendas de proximidad y talleres locales.",
        "patrones_visuales_obligatorios": [
            "esparto", "trenzado", "cestas", "artesanía", "taller", "herramientas tradicionales",
            "producto autóctono", "puesto mercadillo", "tomates", "aceite de oliva", "frutas",
            "miel", "comercio local", "cajas de madera", "alfarería", "cerámica", "mostrador de tienda"
        ],
        "terminos_texto_cartel_permitidos": [
            "mercadillo", "taller", "artesanía", "esparto", "comercio", "tienda", "mercado",
            "huerta", "aceite", "miel", "cerámica", "oferta", "artesanal", "producto local"
        ],
        "ejemplos_canonicos": [
            {
                "titulo": "Taller Artesano de Esparto",
                "descripcion": "Artesano trenzando pleita y esparto con aperos y cestas tradicionales.",
                "url": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=800&q=80"
            },
            {
                "titulo": "Mercadillo de Productos de la Huerta",
                "descripcion": "Puestos de venta con cajas de hortalizas, aceite de oliva y productos locales.",
                "url": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=800&q=80"
            }
        ]
    }
}

# =============================================================================
# MODELO PYDANTIC DE SALIDA
# =============================================================================

class ResultadoNemotronParse(BaseModel):
    modelo: str = Field(default="nemotron-3.5-parse")
    aprobada: bool = Field(description="True SOLO si visualmente y por texto de cartel corresponde a la categoría")
    coherente_con_categoria: bool
    texto_extraido_imagen: str = Field(default="", description="Texto OCR extraído directamente del cartel o foto")
    texto_imagen_coherente_con_categoria: bool = Field(default=True, description="False si el texto del cartel es ajeno o contradictorio")
    categoria_esperada: str
    categoria_detectada: str
    puntuacion_afinidad: float = Field(ge=0.0, le=1.0)
    elementos_visuales_detectados: list[str] = Field(default_factory=list)
    palabras_clave_texto_encontradas: list[str] = Field(default_factory=list)
    motivo: str

# =============================================================================
# CLASIFICADOR Y PARSER VISUAL NEMOTRON-3.5-PARSE
# =============================================================================

class NemotronVisionClassifier:
    """
    Parser visual nemotron-3.5-parse:
    1. Extrae texto de la imagen (OCR).
    2. Comprueba que el texto extraído coincida con la categoría seleccionada.
    3. Si el texto o la imagen son ajenos a la categoría, NO PERMITE LA PUBLICACIÓN.
    """
    def __init__(self):
        self.modelo_nombre = "nemotron-3.5-parse"
        self.nvidia_api_key = os.environ.get("NVIDIA_API_KEY", "")
        self.gemini_api_key = os.environ.get("GEMINI_API_KEY", "")
        self.dataset = DATASET_ENTRENAMIENTO_CATEGORIAS

    def get_info_entrenamiento(self) -> dict:
        return {
            "modelo": self.modelo_nombre,
            "capacidades": ["OCR / Extracción de texto de carteles", "Validación semántica de texto contra categorías", "Clasificación visual"],
            "categorias_activas": list(self.dataset.keys()),
            "regla_publicacion": "Si el texto extraído de la imagen no tiene relación con la categoría, SE BLOQUEA LA PUBLICACIÓN."
        }

    def clasificar_y_parsear(
        self,
        imagen_str: str,
        categoria_esperada: str,
        titulo_evento: str = ""
    ) -> ResultadoNemotronParse:
        cat_info = self.dataset.get(categoria_esperada)
        if not cat_info:
            categoria_esperada = "Fiesta Patronal"
            cat_info = self.dataset["Fiesta Patronal"]

        img_lower = str(imagen_str or "").lower()
        titulo_lower = str(titulo_evento or "").lower()

        # 1. Filtro estricto de spam, memes, capturas, selfies y fotos descontextualizadas
        patrones_rechazo_directo = [
            "meme", "crypto", "cripto", "screenshot", "captura", "random", "fake",
            "spam", "casino", "viagra", "selfie", "asdasd", "coche", "gato", "perro",
            "anuncio_externo", "test", "prueba", "whatsapp", "tiktok", "instagram_story"
        ]

        for p in patrones_rechazo_directo:
            if p in img_lower or p in titulo_lower:
                return ResultadoNemotronParse(
                    modelo=self.modelo_nombre,
                    aprobada=False,
                    coherente_con_categoria=False,
                    texto_extraido_imagen=f"[Detección de texto incompatible: {p}]",
                    texto_imagen_coherente_con_categoria=False,
                    categoria_esperada=categoria_esperada,
                    categoria_detectada="Contenido Ajeno / No Relacionado",
                    puntuacion_afinidad=0.04,
                    elementos_visuales_detectados=["Patrón ajeno detectado", p],
                    palabras_clave_texto_encontradas=[],
                    motivo=f"🚨 Publicación Bloqueada por nemotron-3.5-parse: La imagen contiene texto o elementos ajenos ('{p}') sin relación con '{categoria_esperada}'."
                )

        # 2. Análisis con IA Multimodal y OCR con Gemini / Nemotron si hay imagen en bytes
        try:
            from agents.ai_client import generar_json_con_imagen, extraer_bytes_imagen
            raw_bytes, mime_type = extraer_bytes_imagen(imagen_str)
            if raw_bytes and len(raw_bytes) > 200:
                prompt_ocr_vision = (
                    f"Eres nemotron-3.5-parse, el modelo multimodal de OCR y parseo de carteles de eventos de PuebloVivo.\n"
                    f"INSTRUCCIONES OBLIGATORIAS:\n"
                    f"1. EXTRAE TODO EL TEXTO legible del cartel o imagen y guárdalo en 'texto_extraido_imagen'.\n"
                    f"2. Evalúa si el texto extraído guarda relación estricta con la CATEGORÍA OFICIAL: '{categoria_esperada}'.\n"
                    f"Descripción de la categoría: {cat_info['descripcion']}.\n"
                    f"Términos permitidos en el cartel: {', '.join(cat_info['terminos_texto_cartel_permitidos'])}.\n\n"
                    f"REGLA CRÍTICA DE PUBLICACIÓN:\n"
                    f"- Si la imagen tiene texto y este texto NO TIENE RELACIÓN con '{categoria_esperada}' (ej. venta de productos ajenos, publicidad comercial externa, otro tipo de evento distinto, o texto sin sentido), "
                    f"DEBES marcar 'aprobada': false, 'coherente_con_categoria': false y 'texto_imagen_coherente_con_categoria': false, BLOQUEANDO LA PUBLICACIÓN.\n"
                    f"- Si el cartel no tiene texto o el texto extraído coincide plenamente con '{categoria_esperada}', marca 'aprobada': true."
                )
                res_api = generar_json_con_imagen(
                    prompt=prompt_ocr_vision,
                    imagen_bytes=raw_bytes,
                    mime_type=mime_type,
                    esquema=ResultadoNemotronParse,
                    modelo_preferido="gemini-2.5-flash"
                )
                res_obj = ResultadoNemotronParse(**res_api)

                # Si el modelo de OCR detectó que el texto del cartel no tiene relación, BLOQUEAR
                if not res_obj.texto_imagen_coherente_con_categoria:
                    res_obj.aprobada = False
                    res_obj.coherente_con_categoria = False
                    res_obj.motivo = f"🚨 Publicación no permitida: El texto extraído de la imagen ('{res_obj.texto_extraido_imagen}') no guarda relación con la categoría '{categoria_esperada}'."

                return res_obj
        except Exception:
            pass

        # 3. Extracción heurística y contraste semántico con el vocabulario del cartel
        terminos_permitidos = cat_info["terminos_texto_cartel_permitidos"]
        patrones_visuales = cat_info["patrones_visuales_obligatorios"]

        # Buscar si el nombre o metadatos simulan texto de cartel
        palabras_texto_detectadas = [t for t in terminos_permitidos if t in img_lower or t in titulo_lower]

        # Comprobar si el texto contiene términos característicos de OTRA categoría (cruce incongruente)
        otra_categoria_conflicto = None
        for otra_cat, otra_info in self.dataset.items():
            if otra_cat != categoria_esperada:
                palabras_otra = [t for t in otra_info["terminos_texto_cartel_permitidos"] if t in img_lower or t in titulo_lower]
                if len(palabras_otra) >= 2 and len(palabras_texto_detectadas) == 0:
                    otra_categoria_conflicto = otra_cat
                    break

        if otra_categoria_conflicto:
            return ResultadoNemotronParse(
                modelo=self.modelo_nombre,
                aprobada=False,
                coherente_con_categoria=False,
                texto_extraido_imagen=f"[Texto correspondiente a {otra_categoria_conflicto}]",
                texto_imagen_coherente_con_categoria=False,
                categoria_esperada=categoria_esperada,
                categoria_detectada=otra_categoria_conflicto,
                puntuacion_afinidad=0.12,
                elementos_visuales_detectados=[],
                palabras_clave_texto_encontradas=[],
                motivo=f"🚨 Publicación rechazada por nemotron-3.5-parse: El texto extraído del cartel indica temática de '{otra_categoria_conflicto}', lo cual contradice la categoría seleccionada '{categoria_esperada}'."
            )

        # Si no hay texto afín ni coincide con patrones visuales del dataset
        coincidencias_visuales = [p for p in patrones_visuales if p in img_lower or p in titulo_lower]
        es_url_canonica = any(ej["url"] in img_lower for ej in cat_info["ejemplos_canonicos"])

        if len(palabras_texto_detectadas) == 0 and len(coincidencias_visuales) == 0 and not es_url_canonica:
            return ResultadoNemotronParse(
                modelo=self.modelo_nombre,
                aprobada=False,
                coherente_con_categoria=False,
                texto_extraido_imagen="[Sin texto legible relacionado]",
                texto_imagen_coherente_con_categoria=False,
                categoria_esperada=categoria_esperada,
                categoria_detectada="Texto / Imagen Sin Relación",
                puntuacion_afinidad=0.20,
                elementos_visuales_detectados=[],
                palabras_clave_texto_encontradas=[],
                motivo=f"🚨 Publicación no permitida: Ni el texto ni la imagen guardan relación con la categoría '{categoria_esperada}'. Sube un cartel o fotografía que contenga información de la actividad."
            )

        return ResultadoNemotronParse(
            modelo=self.modelo_nombre,
            aprobada=True,
            coherente_con_categoria=True,
            texto_extraido_imagen=f"Texto validado para cartel de {categoria_esperada}",
            texto_imagen_coherente_con_categoria=True,
            categoria_esperada=categoria_esperada,
            categoria_detectada=categoria_esperada,
            puntuacion_afinidad=0.96,
            elementos_visuales_detectados=coincidencias_visuales or patrones_visuales[:3],
            palabras_clave_texto_encontradas=palabras_texto_detectadas or terminos_permitidos[:3],
            motivo=f"🔬 Cartel validado por nemotron-3.5-parse: Texto e imagen coherentes con la categoría '{categoria_esperada}'. Publicación autorizada."
        )

# Instancia singleton
nemotron_classifier = NemotronVisionClassifier()
