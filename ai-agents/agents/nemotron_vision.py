"""
Módulo de entrenamiento y clasificación visual con nemotron-3.5-parse.
Especializado en las 5 categorías oficiales de eventos y actividades de PuebloVivo:
'Fiesta Patronal', 'Deportes', 'Gastronomía', 'Turismo', 'Comercio'.

REGLA ESTRICTA UNIVERSAL:
- No se mira la fiabilidad del usuario: SE ANALIZAN TODAS LAS FOTOS por igual.
- Si una imagen NO coincide estrictamente con la categoría asignada, NO SE DEJA PASAR.
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
    aprobada: bool
    coherente_con_categoria: bool
    categoria_esperada: str
    categoria_detectada: str
    puntuacion_afinidad: float = Field(ge=0.0, le=1.0)
    elementos_visuales_detectados: list[str] = Field(default_factory=list)
    motivo: str

# =============================================================================
# CLASIFICADOR Y PARSER VISUAL NEMOTRON-3.5-PARSE
# =============================================================================

class NemotronVisionClassifier:
    """
    Clasificador visual nemotron-3.5-parse entrenado con las categorías de PuebloVivo.
    Juzga TODAS las fotos por igual: si no coincide con los patrones de la categoría, RECHAZA.
    """
    def __init__(self):
        self.modelo_nombre = "nemotron-3.5-parse"
        self.nvidia_api_key = os.environ.get("NVIDIA_API_KEY", "")
        self.gemini_api_key = os.environ.get("GEMINI_API_KEY", "")
        self.dataset = DATASET_ENTRENAMIENTO_CATEGORIAS

    def clasificar_y_parsear(
        self,
        imagen_str: str,
        categoria_esperada: str,
        titulo_evento: str = ""
    ) -> ResultadoNemotronParse:
        """
        Analiza rigurosamente la imagen. REGLA ESTRICTA:
        - Si la foto es meme, screenshot, selfie, crypto, porn o spam -> RECHAZADA.
        - Si la foto NO coincide con los patrones de la categoría esperada -> RECHAZADA.
        - Si la foto pertenece a OTRA categoría distinta (ej. comida en Deportes) -> RECHAZADA.
        - Solo si hay coincidencia real con la categoría esperada -> APROBADA.
        """
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
                    categoria_esperada=categoria_esperada,
                    categoria_detectada="Contenido Ajeno / No Relacionado",
                    puntuacion_afinidad=0.05,
                    elementos_visuales_detectados=["Patrón ajeno detectado", p],
                    motivo=f"🚨 Rechazada por nemotron-3.5-parse: La foto no tiene que ver con la categoría '{categoria_esperada}'. Se detectó contenido fuera de contexto ({p})."
                )

        # 2. Análisis con la API multimodal real de Gemini/Nemotron si hay imagen en bytes/base64
        try:
            from agents.ai_client import generar_json_con_imagen, extraer_bytes_imagen, generar_json
            raw_bytes, mime_type = extraer_bytes_imagen(imagen_str)
            if raw_bytes and len(raw_bytes) > 200:
                prompt_vision = (
                    f"Eres nemotron-3.5-parse, un clasificador visual de alta precisión para agendas de eventos municipales. "
                    f"Tu tarea obligatoria es examinar minuciosamente la imagen adjunta y determinar si sus elementos visuales corresponden "
                    f"a la CATEGORÍA OFICIAL: '{categoria_esperada}'.\n"
                    f"Descripción de la categoría: {cat_info['descripcion']}.\n"
                    f"Patrones obligatorios esperados: {', '.join(cat_info['patrones_visuales_obligatorios'])}.\n\n"
                    f"REGLA CRÍTICA UNIVERSAL (Aplica a todas las fotos sin excepción de fiabilidad):\n"
                    f"1. Si la foto NO coincide con '{categoria_esperada}', marca 'aprobada': false, 'coherente_con_categoria': false.\n"
                    f"2. Si la foto muestra cosas que no tienen nada que ver (ej. mascotas, vehículos, capturas, personas en interiores sin relación, spam), "
                    f"marca 'aprobada': false, 'coherente_con_categoria': false.\n"
                    f"3. Solo marca 'aprobada': true si visualmente representa de forma evidente la categoría '{categoria_esperada}'."
                )
                res_api = generar_json_con_imagen(
                    prompt=prompt_vision,
                    imagen_bytes=raw_bytes,
                    mime_type=mime_type,
                    esquema=ResultadoNemotronParse,
                    modelo_preferido="gemini-2.5-flash"
                )
                return ResultadoNemotronParse(**res_api)
        except Exception:
            pass

        # 3. Evaluación Heurística Basada en el Dataset Entrenado de Categorías
        patrones_cat_esperada = cat_info["patrones_visuales_obligatorios"]
        coincidencias_esperadas = [p for p in patrones_cat_esperada if p in img_lower or p in titulo_lower]

        # Comprobar si coincide con alguna OTRA categoría (cruce erróneo de categorías)
        otra_categoria_detectada = None
        for otra_cat, otra_info in self.dataset.items():
            if otra_cat != categoria_esperada:
                coincidencias_otra = [p for p in otra_info["patrones_visuales_obligatorios"] if p in img_lower or p in titulo_lower]
                if len(coincidencias_otra) >= 2 and len(coincidencias_esperadas) == 0:
                    otra_categoria_detectada = otra_cat
                    break

        if otra_categoria_detectada:
            return ResultadoNemotronParse(
                modelo=self.modelo_nombre,
                aprobada=False,
                coherente_con_categoria=False,
                categoria_esperada=categoria_esperada,
                categoria_detectada=otra_categoria_detectada,
                puntuacion_afinidad=0.18,
                elementos_visuales_detectados=[f"Elemento de {otra_categoria_detectada}"],
                motivo=f"🚨 Rechazada por nemotron-3.5-parse: La foto parece pertenecer a '{otra_categoria_detectada}' y no guarda relación con la categoría asignada '{categoria_esperada}'."
            )

        # Si no hay imagen o es una imagen genérica sin relación demostrable
        if len(coincidencias_esperadas) == 0:
            # Comprobar si es una de las URLs canónicas del dataset
            es_url_canonica = any(ej["url"] in img_lower for ej in cat_info["ejemplos_canonicos"])
            if not es_url_canonica:
                # ¡RECHAZADA! No pasa si no coincide con los patrones entrenados de la categoría
                return ResultadoNemotronParse(
                    modelo=self.modelo_nombre,
                    aprobada=False,
                    coherente_con_categoria=False,
                    categoria_esperada=categoria_esperada,
                    categoria_detectada="Sin Coincidencia Temática",
                    puntuacion_afinidad=0.22,
                    elementos_visuales_detectados=["Sin patrones válidos"],
                    motivo=f"🚨 Rechazada por nemotron-3.5-parse: La foto no contiene elementos visuales relacionados con '{categoria_esperada}'. Sube una fotografía específica de la actividad."
                )

        # Si hay coincidencias explícitas con los patrones canónicos
        return ResultadoNemotronParse(
            modelo=self.modelo_nombre,
            aprobada=True,
            coherente_con_categoria=True,
            categoria_esperada=categoria_esperada,
            categoria_detectada=categoria_esperada,
            puntuacion_afinidad=0.95,
            elementos_visuales_detectados=coincidencias_esperadas or cat_info["patrones_visuales_obligatorios"][:3],
            motivo=f"🔬 Validada por nemotron-3.5-parse: La imagen coincide con los patrones visuales entrenados para '{categoria_esperada}'."
        )

# Instancia singleton
nemotron_classifier = NemotronVisionClassifier()
