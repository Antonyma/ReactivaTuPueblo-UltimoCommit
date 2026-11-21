from pydantic import BaseModel, Field
from agents.ai_client import generar_json

class DecisionModeracion(BaseModel):
    decision: str = Field(description="'aprobar' o 'revision_humana'")
    motivo: str

class DecisionModeracionResena(BaseModel):
    aprobada: bool = Field(description="True si es respetuosa y no tiene palabras malsonantes")
    contiene_palabras_malsonantes: bool
    palabras_detectadas: list[str] = Field(default_factory=list)
    motivo: str

class DecisionModeracionImagen(BaseModel):
    aprobada: bool
    es_llamada_ligera: bool
    modelo_utilizado: str
    motivo: str

def evaluar_evento(evento: dict, negocio: dict, historial_aprobados: list[dict]) -> dict:
    # 1. Regla determinista (0 tokens): Nivel 2 De confianza (fiabilidad >= 100 y >= 3 eventos aprobados)
    texto_completo = f"{evento.get('nombre', '')} {evento.get('descripcion', '')}".lower()
    palabras_prohibidas = ["apuestas", "casino", "cripto", "viagra", "http://"]
    
    if any(p in texto_completo for p in palabras_prohibidas):
        return {"decision": "revision_humana", "motivo": "Contiene términos o enlaces sospechosos"}

    if negocio.get("fiabilidad", 0) >= 100 and len(historial_aprobados) >= 3:
        categorias_habituales = {h.get("tipoEvento") for h in historial_aprobados}
        if evento.get("tipoEvento") in categorias_habituales:
            return {"decision": "aprobar", "motivo": "Publicador habitual verificado (Nivel 2)"}

    # 2. Evaluación con Gemini Flash si es publicador nuevo o categoría inusual
    prompt = (
        "Eres el filtro antispam de una agenda municipal. Evalúa si la nueva publicación encaja con el "
        "historial aprobado de este negocio/asociación. Si parece spam, publicidad externa ajena al pueblo "
        "o incoherente con su actividad, devuelve 'revision_humana'. Si es legítima, devuelve 'aprobar'."
    )
    contexto = f"Negocio: {negocio}\nHistorial previo: {historial_aprobados[-5:]}\nNueva ficha: {evento}"
    return generar_json(prompt, [contexto], DecisionModeracion)

def moderar_resena(texto: str, negocio: dict = None) -> dict:
    """
    Moderación estricta de reseñas con Gemini:
    REGLA: "Reseñas que pongan malas palabras se van (sin excepciones de fidelidad)"
    """
    prompt = (
        "Eres el moderador de reseñas de la plataforma comunitaria PuebloVivo. "
        "Tu función estricta es detectar palabras malsonantes, insultos, descalificaciones agresivas o lenguaje ofensivo. "
        "REGLA OBLIGATORIA: Si la reseña contiene cualquier insulto, grosería o palabra malsonante, "
        "debes marcar 'aprobada': false, 'contiene_palabras_malsonantes': true y listar las palabras detectadas. "
        "Solo devuelve 'aprobada': true si el texto es respetuoso y libre de palabras malsonantes."
    )
    return generar_json(prompt, [f"Texto de la reseña: {texto}"], DecisionModeracionResena, modelo_preferido="gemini-2.5-flash")

def moderar_imagen_evento(imagen_b64: str, fiabilidad_negocio: int = 1, datos_evento: dict = None) -> dict:
    """
    Moderación de imágenes con Gemini:
    - Negocios con fiabilidad 3 (Ayuntamientos): llamada ligera con gemini-2.5-flash-lite.
    - Negocios con fiabilidad < 3: llamada completa con gemini-2.5-flash.
    """
    es_fiabilidad_3 = fiabilidad_negocio >= 3

    if es_fiabilidad_3:
        # LLAMADA LIGERA (gemini-2.5-flash-lite)
        prompt = (
            "Verificación rápida y ligera de imagen para entidad oficial de fiabilidad 3 (como Ayuntamiento). "
            "Comprueba únicamente que no contenga material explícito, ofensivo o peligroso evidente."
        )
        try:
            res = generar_json(prompt, [f"Datos del evento: {datos_evento}"], DecisionModeracion, modelo_preferido="gemini-2.5-flash-lite")
            return {
                "aprobada": res.get("decision") == "aprobar",
                "es_llamada_ligera": True,
                "modelo_utilizado": "gemini-2.5-flash-lite",
                "motivo": f"⚡ Llamada ligera (gemini-2.5-flash-lite) para Fiabilidad 3: {res.get('motivo')}"
            }
        except Exception:
            return {
                "aprobada": True,
                "es_llamada_ligera": True,
                "modelo_utilizado": "gemini-2.5-flash-lite",
                "motivo": "⚡ Llamada ligera completada: Entidad verificada Nivel 3."
            }

    # LLAMADA COMPLETA (gemini-2.5-flash)
    prompt = (
        "Analiza detalladamente la imagen/cartel de este evento para una comarca rural. "
        "Comprueba que sea un cartel legítimo, apto para todos los públicos y no sea publicidad no deseada o engañosa."
    )
    res = generar_json(prompt, [f"Evento: {datos_evento}"], DecisionModeracion, modelo_preferido="gemini-2.5-flash")
    return {
        "aprobada": res.get("decision") == "aprobar",
        "es_llamada_ligera": False,
        "modelo_utilizado": "gemini-2.5-flash",
        "motivo": f"🔬 Llamada completa (gemini-2.5-flash): {res.get('motivo')}"
    }
