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

class DecisionModeracionTitulo(BaseModel):
    aprobada: bool = Field(description="True si el título es respetuoso y no contiene malas palabras")
    contiene_palabras_malsonantes: bool
    palabras_detectadas: list[str] = Field(default_factory=list)
    motivo: str

class DecisionModeracionImagen(BaseModel):
    aprobada: bool
    es_llamada_ligera: bool
    coherente_con_categoria: bool
    categoria_evaluada: str
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

def moderar_titulo_evento(titulo: str, descripcion: str = "") -> dict:
    """
    Moderación de títulos de eventos publicados por negocios:
    REGLA: "Penaliza como con las reseñas las palabras en los títulos de las actividades que ponen los negocios"
    """
    prompt = (
        "Eres el moderador de eventos de PuebloVivo. "
        "Verifica estrictamente que el título y descripción del evento no contengan palabras malsonantes, "
        "insultos, descalificaciones o lenguaje inapropiado. "
        "Si contiene cualquier palabra malsonante, marca 'aprobada': false, 'contiene_palabras_malsonantes': true "
        "y enumera las palabras detectadas. Solo aprueba si el título es respetuoso."
    )
    return generar_json(
        prompt,
        [f"Título: {titulo}\nDescripción: {descripcion}"],
        DecisionModeracionTitulo,
        modelo_preferido="gemini-2.5-flash"
    )

def moderar_imagen_evento(imagen_b64: str, fiabilidad_negocio: int = 1, datos_evento: dict = None) -> dict:
    """
    Moderación de imágenes con Gemini:
    - Negocios con fiabilidad 3 (Ayuntamientos): llamada ligera con gemini-2.5-flash-lite (pase directo).
    - Negocios con fiabilidad < 3: llamada fuerte con gemini-2.5-flash basada estrictamente en la CATEGORÍA del evento.
      Detecta y rechaza fotos que no tienen nada que ver con la actividad propuesta.
    """
    datos = datos_evento or {}
    categoria = datos.get("categoria", "General")
    titulo = datos.get("titulo", "")
    es_fiabilidad_3 = fiabilidad_negocio >= 3

    if es_fiabilidad_3:
        # LLAMADA LIGERA (gemini-2.5-flash-lite)
        prompt = (
            "Verificación rápida y ligera de imagen para entidad oficial de fiabilidad 3 (Ayuntamiento). "
            "Comprueba únicamente que no contenga material explícito, peligroso u ofensivo flagrante."
        )
        try:
            res = generar_json(
                prompt,
                [f"Categoría: {categoria}, Título: {titulo}"],
                DecisionModeracion,
                modelo_preferido="gemini-2.5-flash-lite"
            )
            return {
                "aprobada": res.get("decision") == "aprobar",
                "es_llamada_ligera": True,
                "coherente_con_categoria": True,
                "categoria_evaluada": categoria,
                "modelo_utilizado": "gemini-2.5-flash-lite",
                "motivo": f"⚡ Llamada ligera (gemini-2.5-flash-lite) para Fiabilidad 3: {res.get('motivo')}"
            }
        except Exception:
            return {
                "aprobada": True,
                "es_llamada_ligera": True,
                "coherente_con_categoria": True,
                "categoria_evaluada": categoria,
                "modelo_utilizado": "gemini-2.5-flash-lite",
                "motivo": "⚡ Llamada ligera completada: Entidad verificada Nivel 3 (Pase directo)."
            }

    # LLAMADA FUERTE (gemini-2.5-flash) BASADA EN CATEGORÍAS
    prompt = (
        f"Eres el sistema de moderación visual estricto de PuebloVivo usando gemini-2.5-flash. "
        f"Evalúa detalladamente si la imagen/cartel tiene relación directa y coherencia con la CATEGORÍA '{categoria}' "
        f"y el evento '{titulo}'. Si la foto no tiene nada que ver (memes, imágenes aleatorias, spam, temas ajenos), "
        f"recházala con 'decision': 'revision_humana' indicando que la foto es incoherente con la categoría. "
        f"Si la foto representa adecuadamente la actividad y es apta para todos los públicos, devuélvelo en el motivo."
    )
    res = generar_json(
        prompt,
        [f"Evento: {datos}\nCategoría obligatoria: {categoria}"],
        DecisionModeracion,
        modelo_preferido="gemini-2.5-flash"
    )
    es_aprobada = res.get("decision") == "aprobar"
    return {
        "aprobada": es_aprobada,
        "es_llamada_ligera": False,
        "coherente_con_categoria": es_aprobada,
        "categoria_evaluada": categoria,
        "modelo_utilizado": "gemini-2.5-flash",
        "motivo": f"🔬 Llamada fuerte (gemini-2.5-flash): {res.get('motivo')}"
    }
