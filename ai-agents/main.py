import base64
from typing import Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Importamos los 4 agentes desde la misma carpeta agents/
from agents.extractor import extraer_evento, get_imagen, municipio_canonico, a_fila_evento, Supabase, MUNICIPIOS
from agents.moderate import evaluar_evento
from agents.recommend import recomendar_a_vecinos
from agents.event_chat import responder_duda_evento

app = FastAPI(title="ReactivaTuPueblo · 4 Micro-Agentes IA")
sb = Supabase()

# --- Modelos de petición ---
class ReqExtract(BaseModel):
    texto: str = ""
    url_post: Optional[str] = None
    imagen_url: Optional[str] = None
    imagen_base64: Optional[str] = None
    imagen_mime: str = "image/jpeg"
    audio_base64: Optional[str] = None
    audio_mime: str = "audio/ogg"
    municipio: Optional[str] = None
    guardar: bool = False

class ReqModerate(BaseModel):
    evento: dict
    negocio: dict
    historial_aprobados: list[dict] = []

class ReqRecommend(BaseModel):
    evento: dict
    vecinos: list[dict]

class ReqEventChat(BaseModel):
    pregunta: str = ""
    ficha_evento: dict
    audio_base64: Optional[str] = None
    audio_mime: str = "audio/ogg"
    devolver_audio: bool = False

# --- LOS 4 ENDPOINTS DE LOS MICRO-AGENTES ---

@app.post("/agents/extract")
def endpoint_extract(p: ReqExtract):
    if not (p.texto or p.imagen_base64 or p.imagen_url or p.audio_base64):
        raise HTTPException(400, "Envía texto, imagen o audio")
    if p.url_post and sb.activo and sb.existe(p.url_post):
        return {"duplicado": True, "url_post": p.url_post}

    pista = municipio_canonico(p.municipio) if p.municipio else None
    if p.municipio and not pista:
        raise HTTPException(422, f"Municipio fuera de ámbito. Solo: {', '.join(MUNICIPIOS)}")

    img = (base64.b64decode(p.imagen_base64), p.imagen_mime) if p.imagen_base64 else None
    if not img and p.imagen_url:
        datos, mime = get_imagen(p.imagen_url)
        img = (datos, mime) if datos else None
    aud = (base64.b64decode(p.audio_base64), p.audio_mime) if p.audio_base64 else None

    ext = extraer_evento(p.texto, imagen=img, audio=aud, pista_municipio=pista)
    if not ext:
        return {"es_evento": False, "motivo": "No es un evento o está fuera de los 4 municipios"}
    
    ext["duplicado"] = False
    if p.guardar and sb.activo and ext["titulo"] and ext["fecha_hora"] and p.url_post:
        ext["_guardado"] = sb.insertar(a_fila_evento(ext, p.url_post, p.imagen_url, sb))
    return ext

@app.post("/agents/moderate")
def endpoint_moderate(req: ReqModerate):
    return evaluar_evento(req.evento, req.negocio, req.historial_aprobados)

@app.post("/agents/recommend")
def endpoint_recommend(req: ReqRecommend):
    return recomendar_a_vecinos(req.evento, req.vecinos)

@app.post("/agents/event-chat")
async def endpoint_event_chat(req: ReqEventChat):
    aud = base64.b64decode(req.audio_base64) if req.audio_base64 else None
    return await responder_duda_evento(
        req.pregunta, req.ficha_evento, aud, req.audio_mime, req.devolver_audio
    )