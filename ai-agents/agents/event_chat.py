"""
Agente conversacional para resolver dudas sobre un evento concreto de PuebloVivo.
Usa Gemini si GEMINI_API_KEY está configurada y ofrece un fallback determinista
basado en la ficha del evento si el proveedor LLM no está disponible.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


def _respuesta_fallback(pregunta: str, ficha: dict) -> str:
    texto = (pregunta or "").lower()
    nombre = ficha.get("nombre") or ficha.get("titulo") or "esta actividad"
    descripcion = ficha.get("descripcion") or "Actividad local organizada en la comarca."
    pueblo = ficha.get("pueblo") or "la comarca"
    negocio = ficha.get("negocio") or "el organizador local"
    aforo = int(ficha.get("aforo") or 0)
    asistentes = int(ficha.get("asistentes") or 0)
    plazas_libres = max(0, aforo - asistentes)
    de_pago = bool(ficha.get("dePago") or ficha.get("de_pago"))
    fecha_inicio = ficha.get("fechaInicio") or ficha.get("fecha_inicio") or "por confirmar"
    fecha_fin = ficha.get("fechaFin") or ficha.get("fecha_fin") or ""

    if any(k in texto for k in ("precio", "pago", "gratis", "cuesta", "coste", "entrada")):
        if de_pago:
            return f'"{nombre}" es una actividad de pago organizada por {negocio}.'
        return f'"{nombre}" es una actividad gratuita organizada por {negocio}.'

    if any(k in texto for k in ("plaza", "aforo", "sitio", "cupo", "lleno")):
        if aforo > 0:
            return f'Quedan {plazas_libres} plazas libres de un aforo total de {aforo} para "{nombre}".'
        return f'No hay un límite de aforo registrado para "{nombre}".'

    if any(k in texto for k in ("fecha", "hora", "cuándo", "cuando", "horario", "dura")):
        if fecha_fin:
            return f'"{nombre}" comienza el {fecha_inicio} y finaliza el {fecha_fin}.'
        return f'"{nombre}" está programada para el {fecha_inicio}.'

    if any(k in texto for k in ("dónde", "donde", "lugar", "ubicación", "ubicacion", "pueblo")):
        return f'"{nombre}" se celebra en {pueblo}, organizada por {negocio}.'

    return (
        f'Sobre "{nombre}" ({pueblo}): {descripcion} '
        f'Organiza {negocio}. {"Actividad de pago." if de_pago else "Entrada gratuita."}'
    )


async def responder_duda_evento(
    pregunta: str,
    ficha_evento: dict,
    audio_bytes: Optional[bytes] = None,
    audio_mime: str = "audio/ogg",
    devolver_audio: bool = False,
) -> dict:
    """Responde dudas de un vecino sobre una ficha de evento."""
    pregunta_limpia = (pregunta or "").strip()
    if not pregunta_limpia and not audio_bytes:
        return {
            "respuesta": "¿En qué puedo ayudarte respecto a esta actividad?",
            "fuente": "fallback-local",
        }

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if api_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)
            prompt = (
                "Eres el asistente local de PuebloVivo. Responde en español, de forma breve, "
                "cercana y precisa (máximo 3 frases) usando SOLO los datos de la ficha del evento. "
                "Si un dato no aparece en la ficha, indícalo amablemente.\n\n"
                f"FICHA DEL EVENTO:\n{ficha_evento}\n\n"
                f"PREGUNTA DEL VECINO:\n{pregunta_limpia or 'Responde al mensaje de audio adjunto.'}"
            )
            contents = [prompt]
            if audio_bytes:
                contents.append(types.Part.from_bytes(data=audio_bytes, mime_type=audio_mime))

            resp = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=contents,
                config=types.GenerateContentConfig(temperature=0.2),
            )
            texto_resp = (getattr(resp, "text", None) or "").strip()
            if texto_resp:
                return {
                    "respuesta": texto_resp,
                    "fuente": "gemini-2.5-flash",
                }
        except Exception as exc:
            logger.warning("Fallback en responder_duda_evento tras error de Gemini: %s", exc)

    return {
        "respuesta": _respuesta_fallback(pregunta_limpia, ficha_evento or {}),
        "fuente": "fallback-local",
    }

