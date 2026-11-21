from pydantic import BaseModel, Field
from agents.ai_client import generar_json

class ResultadoRecomendacion(BaseModel):
    usuarios_ids: list[int] = Field(description="IDs de los usuarios cuyos intereses encajan con el evento")
    mensaje_whatsapp: str = Field(description="Mensaje corto y cercano invitando al evento")

def recomendar_a_vecinos(evento: dict, vecinos: list[dict]) -> dict:
    candidatos = [
        {"id": v["id"], "nombre": v["nombre"], "intereses": v.get("intereses", "")}
        for v in vecinos if v.get("intereses")
    ]
    if not candidatos:
        return {"usuarios_ids": [], "mensaje_whatsapp": ""}

    prompt = (
        "Selecciona los IDs de los vecinos cuyos gustos encajan con el evento propuesto "
        "(ej. 'me gustan las rutas' encaja con senderismo o turismo). "
        "Redacta un mensaje breve y amable para enviarles por WhatsApp."
    )
    contexto = f"Evento aprobado: {evento}\nVecinos disponibles: {candidatos}"
    return generar_json(prompt, [contexto], ResultadoRecomendacion)
    """
Módulo Recomendador Inteligente de Actividades de PuebloVivo.
Analiza el historial del usuario en la tabla 'inscripcion' de Supabase,
detecta sus categorías favoritas y reordena las actividades disponibles
mostrando primero las recomendadas con explicación personalizada por IA.
"""

"""
Módulo Recommend Inteligente de Actividades de PuebloVivo.
Analiza el historial del usuario en la tabla 'inscripcion' de Supabase,
detecta sus categorías favoritas y reordena las actividades disponibles
mostrando primero las recomendadas con explicación personalizada por IA.
"""

import os
import re
import json
import logging
import urllib.request
import urllib.parse
from collections import Counter
from typing import Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# =============================================================================
# MODELOS PYDANTIC DE SALIDA
# =============================================================================

class ItemRecommendIA(BaseModel):
    actividad_id: str
    puntuacion_relevancia: float = Field(ge=0.0, le=1.0)
    razon_personalizada: str = Field(description="Frase corta y cercana explicando por qué se recomienda al usuario")


class RespuestaRankingIA(BaseModel):
    perfil_usuario_resumen: str = Field(description="Breve resumen de los gustos del vecino según sus inscripciones")
    recommendations: list[ItemRecommendIA] = Field(default_factory=list)


# =============================================================================
# RECOMMEND CON SUPABASE ('inscripcion') + NVIDIA NIM / OPENROUTER / GEMINI
# =============================================================================

class RecommendActividades:
    def __init__(self):
        self.supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.supabase_key = os.environ.get("SUPABASE_KEY", "")
        self.nvidia_api_key = os.environ.get("NVIDIA_API_KEY", "")
        self.openrouter_api_key = os.environ.get("OPENROUTER_API_KEY", "")
        self.gemini_api_key = os.environ.get("GEMINI_API_KEY", "")

        self.modelo_principal = "nvidia/llama-3.1-nemotron-70b-instruct"

    # -------------------------------------------------------------------------
    # 1. CONSULTA A SUPABASE (TABLA 'inscripcion' Y 'actividades')
    # -------------------------------------------------------------------------
    def _consultar_supabase(self, tabla: str, query_params: str = "") -> list[dict]:
        """Consulta REST ligera a Supabase usando SUPABASE_URL y SUPABASE_KEY del .env."""
        if not self.supabase_url or not self.supabase_key:
            logger.warning("Faltan SUPABASE_URL o SUPABASE_KEY en el .env")
            return []

        url = f"{self.supabase_url}/rest/v1/{tabla}"
        if query_params:
            url = f"{url}?{query_params}"

        req = urllib.request.Request(
            url,
            headers={
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            method="GET"
        )

        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            logger.error(f"Error consultando tabla '{tabla}' en Supabase: {e}")
            return []

    def obtener_historial_inscripciones(self, usuario_id: str) -> list[dict]:
        """
        Obtiene las inscripciones anteriores del usuario desde la tabla 'inscripcion'.
        Soporta columnas habituales de identificación de usuario ('usuario_id', 'user_id', 'email').
        """
        if not usuario_id:
            return []

        uid_encoded = urllib.parse.quote(str(usuario_id))

        filas = self._consultar_supabase(
            "inscripcion",
            f"select=*&usuario_id=eq.{uid_encoded}"
        )
        if not filas:
            filas = self._consultar_supabase(
                "inscripcion",
                f"select=*&user_id=eq.{uid_encoded}"
            )
        if not filas and "@" in str(usuario_id):
            filas = self._consultar_supabase(
                "inscripcion",
                f"select=*&email=eq.{uid_encoded}"
            )

        return filas

    def _extraer_preferencias_categorias(
        self,
        inscripciones: list[dict],
        catalogo_actividades: list[dict]
    ) -> tuple[Counter, list[dict]]:
        """
        Extrae las categorías de las actividades en las que el usuario se inscribió antes.
        Si la tabla 'inscripcion' guarda 'categoria' directamente la usa;
        si solo guarda 'actividad_id' / 'evento_id', cruza con el catálogo de actividades.
        """
        mapa_actividades = {
            str(act.get("id")): act
            for act in catalogo_actividades
            if act.get("id") is not None
        }

        conteo_categorias = Counter()
        historial_detallado = []

        for ins in inscripciones:
            act_id = str(ins.get("actividad_id") or ins.get("evento_id") or "")
            act_info = mapa_actividades.get(act_id, {})

            categoria = (
                ins.get("categoria")
                or act_info.get("categoria")
                or ""
            ).strip()

            titulo = (
                ins.get("titulo_actividad")
                or ins.get("titulo")
                or act_info.get("titulo")
                or act_info.get("nombre")
                or "Actividad previa"
            )

            if categoria:
                conteo_categorias[categoria] += 1
                historial_detallado.append({
                    "actividad_id": act_id,
                    "titulo": titulo,
                    "categoria": categoria
                })

        return conteo_categorias, historial_detallado

    # -------------------------------------------------------------------------
    # 2. ENRUTADOR IA MULTI-MODELO (NVIDIA NIM -> OPENROUTER -> GEMINI)
    # -------------------------------------------------------------------------
    def _llamar_ia_ranking(self, prompt: str) -> Optional[dict]:
        rutas = []

        # 1. NVIDIA NIM (Nemotron 70B)
        if self.nvidia_api_key:
            rutas.append((
                "https://integrate.api.nvidia.com/v1/chat/completions",
                self.nvidia_api_key,
                "nvidia/llama-3.1-nemotron-70b-instruct",
                "nim"
            ))

        # 2. OpenRouter Failover
        if self.openrouter_api_key:
            rutas.extend([
                ("https://openrouter.ai/api/v1/chat/completions", self.openrouter_api_key, "nvidia/llama-3.1-nemotron-70b-instruct", "openrouter"),
                ("https://openrouter.ai/api/v1/chat/completions", self.openrouter_api_key, "meta-llama/llama-3.3-70b-instruct", "openrouter"),
                ("https://openrouter.ai/api/v1/chat/completions", self.openrouter_api_key, "google/gemini-2.5-flash", "openrouter"),
            ])

        for endpoint, key, modelo, proveedor in rutas:
            try:
                headers = {
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json"
                }
                if proveedor == "openrouter":
                    headers["HTTP-Referer"] = "https://pueblovivo.local"
                    headers["X-Title"] = "PuebloVivo-Recommend"

                payload = {
                    "model": modelo,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                    "max_tokens": 900
                }

                req = urllib.request.Request(
                    endpoint,
                    data=json.dumps(payload).encode("utf-8"),
                    headers=headers,
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    texto = data["choices"][0]["message"]["content"]
                    limpio = re.sub(r"^```(?:json)?\s*|\s*```$", "", texto.strip())
                    parsed = json.loads(limpio)
                    validado = RespuestaRankingIA(**parsed).model_dump()
                    validado["modelo_utilizado"] = f"{proveedor}/{modelo}"
                    return validado
            except Exception as e:
                logger.warning(f"Recommend failover ({proveedor}/{modelo}): {e}")

        # 3. Fallback a Gemini directo si NIM y OpenRouter fallaron
        if self.gemini_api_key:
            try:
                url_gem = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={self.gemini_api_key}"
                payload_gem = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}
                }
                req = urllib.request.Request(
                    url_gem,
                    data=json.dumps(payload_gem).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    texto = data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(texto)
                    validado = RespuestaRankingIA(**parsed).model_dump()
                    validado["modelo_utilizado"] = "google/gemini-2.5-flash"
                    return validado
            except Exception as e:
                logger.warning(f"Recommend Gemini fallback falló: {e}")

        return None

    # -------------------------------------------------------------------------
    # 3. FUNCIÓN PRINCIPAL: RECOMMEND Y ORDENAR ACTIVIDADES PRIMERO
    # -------------------------------------------------------------------------
    def recommend_actividades_usuario(
        self,
        usuario_id: str,
        actividades_disponibles: Optional[list[dict]] = None,
        excluir_ya_inscritas: bool = True
    ) -> dict:
        """
        Lee la tabla 'inscripcion' de Supabase para el usuario indicado,
        identifica las categorías en las que participó anteriormente y devuelve
        todas las actividades ordenadas poniendo PRIMERO las recomendadas.
        """
        if actividades_disponibles is None:
            actividades_disponibles = self._consultar_supabase("actividades", "select=*")
            if not actividades_disponibles:
                actividades_disponibles = self._consultar_supabase("eventos", "select=*")

        if not actividades_disponibles:
            return {
                "usuario_id": usuario_id,
                "tiene_historial": False,
                "categorias_favoritas": [],
                "perfil_resumen": "Aún no hay actividades disponibles en la agenda.",
                "actividades_ordenadas": [],
                "solo_recomendadas": [],
                "modelo_utilizado": "sin-datos"
            }

        # 1. Consultar historial en tabla 'inscripcion'
        inscripciones = self.obtener_historial_inscripciones(usuario_id)
        ids_ya_inscritos = {
            str(ins.get("actividad_id") or ins.get("evento_id"))
            for ins in inscripciones
            if (ins.get("actividad_id") or ins.get("evento_id")) is not None
        }

        conteo_categorias, historial_detallado = self._extraer_preferencias_categorias(
            inscripciones,
            actividades_disponibles
        )

        # Filtrar candidatas
        candidatas = []
        for act in actividades_disponibles:
            act_id = str(act.get("id", ""))
            if excluir_ya_inscritas and act_id in ids_ya_inscritos:
                continue
            candidatas.append(act)

        if not candidatas:
            candidatas = list(actividades_disponibles)

        # Si el usuario es nuevo y no tiene inscripciones previas en 'inscripcion'
        if not conteo_categorias:
            resultado_nuevo = []
            for act in candidatas:
                copia = dict(act)
                copia["es_recomendada"] = False
                copia["score_recommend"] = 0.5
                copia["motivo_recommend"] = "Actividad destacada en PuebloVivo"
                resultado_nuevo.append(copia)

            return {
                "usuario_id": usuario_id,
                "tiene_historial": False,
                "categorias_favoritas": [],
                "perfil_resumen": "Usuario nuevo sin inscripciones previas. Mostrando agenda general.",
                "actividades_ordenadas": resultado_nuevo,
                "solo_recomendadas": [],
                "modelo_utilizado": "cold-start"
            }

        # 2. Calcular afinidad base por frecuencia de categorías en 'inscripcion'
        total_inscripciones = sum(conteo_categorias.values())
        categorias_ordenadas = [cat for cat, _ in conteo_categorias.most_common()]
        pesos_categoria = {
            cat: round(count / total_inscripciones, 3)
            for cat, count in conteo_categorias.items()
        }

        # 3. Enriquecer y afinar ranking con IA (NVIDIA Nemotron / OpenRouter / Gemini)
        resumen_candidatas = [
            {
                "id": str(a.get("id")),
                "titulo": a.get("titulo") or a.get("nombre") or "",
                "categoria": a.get("categoria") or "",
                "descripcion": (a.get("descripcion") or "")[:160]
            }
            for a in candidatas[:25]
        ]

        prompt_ia = f"""Eres el asistente recommend de actividades culturales, deportivas y sociales de PuebloVivo.
Analiza el historial real de inscripciones del usuario y puntúa las actividades disponibles para mostrarle PRIMERO las que más encajan con sus gustos.

HISTORIAL DE INSCRIPCIONES ANTERIORES DEL USUARIO (tabla 'inscripcion'):
- Frecuencia por categoría: {json.dumps(dict(conteo_categorias), ensure_ascii=False)}
- Actividades a las que asistió: {json.dumps(historial_detallado[-10:], ensure_ascii=False)}

ACTIVIDADES DISPONIBLES ACTUALMENTE:
{json.dumps(resumen_candidatas, ensure_ascii=False)}

INSTRUCCIONES:
1. Da mayor 'puntuacion_relevancia' (0.70 a 1.0) a las actividades que coincidan con las categorías anteriores del usuario o sean complementarias a sus gustos.
2. Da menor puntuación (0.10 a 0.55) a las categorías en las que nunca ha participado.
3. Escribe en 'razon_personalizada' una frase breve, natural y amigable en español (ej: "Porque ya disfrutaste de rutas de Turismo anteriormente").

DEVUELVE ÚNICAMENTE UN JSON VÁLIDO con esta estructura (sin markdown):
{{
  "perfil_usuario_resumen": "resumen corto de intereses del usuario",
  "recommendations": [
    {{
      "actividad_id": "id_exacto",
      "puntuacion_relevancia": 0.95,
      "razon_personalizada": "frase corta para mostrar en la tarjeta"
    }}
  ]
}}"""

        respuesta_ia = self._llamar_ia_ranking(prompt_ia)
        mapa_ia = {}
        perfil_resumen = f"Te interesan especialmente: {', '.join(categorias_ordenadas[:2])}."
        modelo_usado = "heuristica-categorias"

        if respuesta_ia:
            modelo_usado = respuesta_ia.get("modelo_utilizado", self.modelo_principal)
            perfil_resumen = respuesta_ia.get("perfil_usuario_resumen", perfil_resumen)
            for item in respuesta_ia.get("recommendations", []):
                mapa_ia[str(item["actividad_id"])] = item

        # 4. Combinar puntuación determinista de categoría + puntuación semántica IA
        actividades_puntuadas = []
        for act in candidatas:
            act_id = str(act.get("id", ""))
            cat_act = (act.get("categoria") or "").strip()
            veces_en_cat = conteo_categorias.get(cat_act, 0)
            peso_cat = pesos_categoria.get(cat_act, 0.0)

            info_ia = mapa_ia.get(act_id)
            score_ia = float(info_ia["puntuacion_relevancia"]) if info_ia else (0.75 if veces_en_cat > 0 else 0.30)

            if veces_en_cat > 0:
                score_final = round(min(1.0, 0.65 + (0.20 * peso_cat) + (0.15 * score_ia)), 3)
                es_recomendada = True
                motivo = (
                    info_ia["razon_personalizada"]
                    if info_ia and info_ia.get("razon_personalizada")
                    else f"✨ Recomendado porque participaste en {veces_en_cat} actividad(es) de '{cat_act}'"
                )
            else:
                score_final = round(score_ia * 0.60, 3)
                es_recomendada = score_final >= 0.50
                motivo = (
                    info_ia["razon_personalizada"]
                    if info_ia and info_ia.get("razon_personalizada")
                    else f"Descubre una nueva experiencia en '{cat_act}'"
                )

            copia = dict(act)
            copia["es_recomendada"] = es_recomendada
            copia["score_recommend"] = score_final
            copia["motivo_recommend"] = motivo
            actividades_puntuadas.append(copia)

        # 5. ORDENAR: Primero las recomendadas (es_recomendada=True) y de mayor a menor score
        actividades_ordenadas = sorted(
            actividades_puntuadas,
            key=lambda x: (x["es_recomendada"], x["score_recommend"]),
            reverse=True
        )

        solo_recomendadas = [a for a in actividades_ordenadas if a["es_recomendada"]]

        return {
            "usuario_id": usuario_id,
            "tiene_historial": True,
            "total_inscripciones_previas": total_inscripciones,
            "categorias_favoritas": categorias_ordenadas,
            "desglose_categorias": dict(conteo_categorias),
            "perfil_resumen": perfil_resumen,
            "actividades_ordenadas": actividades_ordenadas,
            "solo_recomendadas": solo_recomendadas,
            "modelo_utilizado": modelo_usado
        }


# Instancia singleton lista para importar en main.py
recommend_actividades = RecommendActividades()