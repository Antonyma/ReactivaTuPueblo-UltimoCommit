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