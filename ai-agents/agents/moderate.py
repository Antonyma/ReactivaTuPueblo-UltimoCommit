from pydantic import BaseModel, Field
from agents.ai_client import generar_json

class DecisionModeracion(BaseModel):
    decision: str = Field(description="'aprobar' o 'revision_humana'")
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