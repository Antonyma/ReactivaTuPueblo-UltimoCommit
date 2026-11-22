import binascii
import json
import os
import base64
import queue
import threading
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR / "agents" / ".env")

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Importamos los agentes desde la misma carpeta agents/
from agents.extractor import extraer_evento, get_imagen, municipio_canonico, a_fila_evento, Supabase, MUNICIPIOS
from agents.business_social_scraper import scrapear_redes_negocio
from agents.moderador import evaluar_evento, moderar_resena, moderar_imagen_evento, moderar_titulo_evento, moderar_actividad_autonoma, moderar_eventos_batch
from agents.imagenes_actividades import nemotron_classifier
from agents.recommend import recomendar_a_vecinos, recommend_actividades
from agents.event_chat import responder_duda_evento

INTERNAL_API_KEY = os.environ.get("AI_AGENTS_API_KEY", "").strip()
RAW_CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "").strip()
ALLOWED_ORIGINS = [o.strip() for o in RAW_CORS_ORIGINS.split(",") if o.strip()] if RAW_CORS_ORIGINS else ["*"]


def verify_api_key(x_api_key: Optional[str] = Header(default=None)):
    if INTERNAL_API_KEY and x_api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="API Key interna inválida o ausente")


def decode_base64_safe(raw: str, field_name: str) -> bytes:
    try:
        return base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"{field_name} no contiene base64 válido") from exc


app = FastAPI(title="ReactivaTuPueblo · Micro-Agentes IA y Moderación")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=ALLOWED_ORIGINS != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
sb = Supabase()


@app.get("/health")
def endpoint_health():
    return {"status": "ok", "service": "ai-agents"}

# --- Modelos de petición ---
class ReqModerateReview(BaseModel):
    texto: str
    negocio: Optional[dict] = None

class ReqModerateImage(BaseModel):
    imagen_base64: str = ""
    fiabilidad_negocio: int = 1
    datos_evento: Optional[dict] = None

class ReqModerateEventTitle(BaseModel):
    titulo: str
    descripcion: str = ""
    categoria: str = "Fiesta Patronal"

class ReqModerateAutonomous(BaseModel):
    evento: dict
    fiabilidad_negocio: Optional[float] = 1.0

class ReqModerateBatch(BaseModel):
    eventos: list[dict]
    fiabilidad: Optional[int] = 1
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

class ReqRecommendActivities(BaseModel):
    usuario_id: Optional[str] = None
    actividades_disponibles: Optional[list[dict]] = None
    excluir_ya_inscritas: bool = True

class ReqEventChat(BaseModel):
    pregunta: str = ""
    ficha_evento: Optional[dict] = None
    evento: Optional[dict] = None
    audio_base64: Optional[str] = None
    audio_mime: str = "audio/ogg"
    devolver_audio: bool = False


class ReqScrapeBusinessSocials(BaseModel):
    negocio: dict
    urls_existentes: list[str] = []
    huellas_existentes: list[str] = []
    texto_manual: Optional[str] = None
    red_manual: Optional[str] = None
    url_post_manual: Optional[str] = None

# --- ENDPOINTS DE LOS MICRO-AGENTES ---

@app.post("/agents/extract", dependencies=[Depends(verify_api_key)])
def endpoint_extract(p: ReqExtract):
    if not (p.texto or p.imagen_base64 or p.imagen_url or p.audio_base64):
        raise HTTPException(400, "Envía texto, imagen o audio")
    if p.url_post and sb.activo and sb.existe(p.url_post):
        return {"duplicado": True, "url_post": p.url_post}

    pista = municipio_canonico(p.municipio) if p.municipio else None
    if p.municipio and not pista:
        raise HTTPException(422, f"Municipio fuera de ámbito. Solo: {', '.join(MUNICIPIOS)}")

    img = (decode_base64_safe(p.imagen_base64, "imagen_base64"), p.imagen_mime) if p.imagen_base64 else None
    if not img and p.imagen_url:
        datos, mime = get_imagen(p.imagen_url)
        img = (datos, mime) if datos else None
    aud = (decode_base64_safe(p.audio_base64, "audio_base64"), p.audio_mime) if p.audio_base64 else None

    ext = extraer_evento(p.texto, imagen=img, audio=aud, pista_municipio=pista)
    if not ext:
        return {"es_evento": False, "motivo": "No es un evento o está fuera de los municipios"}

    ext["duplicado"] = False
    if p.guardar and sb.activo and ext.get("titulo") and ext.get("fecha_hora") and p.url_post:
        try:
            ext["_guardado"] = sb.insertar(a_fila_evento(ext, p.url_post, p.imagen_url, sb))
        except Exception as exc:
            raise HTTPException(502, f"Error guardando evento en Supabase: {exc}") from exc
    return ext

@app.post("/agents/moderate", dependencies=[Depends(verify_api_key)])
def endpoint_moderate(req: ReqModerate):
    return evaluar_evento(req.evento, req.negocio, req.historial_aprobados)

@app.post("/agents/moderate/review", dependencies=[Depends(verify_api_key)])
def endpoint_moderate_review(req: ReqModerateReview):
    return moderar_resena(req.texto, req.negocio)

@app.post("/agents/moderate/image", dependencies=[Depends(verify_api_key)])
def endpoint_moderate_image(req: ReqModerateImage):
    return moderar_imagen_evento(req.imagen_base64, req.fiabilidad_negocio, req.datos_evento)

@app.post("/agents/moderate/event-title", dependencies=[Depends(verify_api_key)])
def endpoint_moderate_event_title(req: ReqModerateEventTitle):
    return moderar_titulo_evento(req.titulo, req.descripcion, req.categoria)

@app.post("/agents/moderate/autonomous", dependencies=[Depends(verify_api_key)])
def endpoint_moderate_autonomous(req: ReqModerateAutonomous):
    evento_con_fiab = dict(req.evento)
    if req.fiabilidad_negocio is not None and "fiabilidad_negocio" not in evento_con_fiab:
        evento_con_fiab["fiabilidad_negocio"] = req.fiabilidad_negocio
    return moderar_actividad_autonoma(evento_con_fiab)

@app.post("/agents/moderate/batch", dependencies=[Depends(verify_api_key)])
def endpoint_moderate_batch(req: ReqModerateBatch):
    return moderar_eventos_batch(req.eventos, req.fiabilidad or 1)

@app.get("/agents/moderate/train-nemotron")
def endpoint_train_nemotron():
    return nemotron_classifier.get_info_entrenamiento()

@app.post("/agents/recommend", dependencies=[Depends(verify_api_key)])
def endpoint_recommend(req: ReqRecommend):
    return recomendar_a_vecinos(req.evento, req.vecinos)

@app.post("/agents/recommend-activities", dependencies=[Depends(verify_api_key)])
def endpoint_recommend_activities(req: ReqRecommendActivities):
    return recommend_actividades.recommend_actividades_usuario(
        str(req.usuario_id or "anonimo"),
        req.actividades_disponibles,
        req.excluir_ya_inscritas,
    )

@app.post("/agents/event-chat", dependencies=[Depends(verify_api_key)])
async def endpoint_event_chat(req: ReqEventChat):
    ficha = req.ficha_evento or req.evento or {}
    aud = decode_base64_safe(req.audio_base64, "audio_base64") if req.audio_base64 else None
    return await responder_duda_evento(
        req.pregunta, ficha, aud, req.audio_mime, req.devolver_audio
    )


@app.post("/agents/scrape-business-socials", dependencies=[Depends(verify_api_key)])
def endpoint_scrape_business_socials(req: ReqScrapeBusinessSocials):
    try:
        return scrapear_redes_negocio(
            negocio=req.negocio,
            urls_existentes=req.urls_existentes,
            huellas_existentes=req.huellas_existentes,
            texto_manual=req.texto_manual,
            red_manual=req.red_manual,
            url_post_manual=req.url_post_manual,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error en scraping de negocio: {exc}") from exc


@app.post("/agents/scrape-business-socials/stream", dependencies=[Depends(verify_api_key)])
def endpoint_scrape_business_socials_stream(req: ReqScrapeBusinessSocials):
    eventos_q: queue.Queue = queue.Queue()

    def _on_progress(progress: int, message: str) -> None:
        eventos_q.put({"type": "progress", "progress": progress, "message": message})

    def _worker() -> None:
        try:
            result = scrapear_redes_negocio(
                negocio=req.negocio,
                urls_existentes=req.urls_existentes,
                huellas_existentes=req.huellas_existentes,
                texto_manual=req.texto_manual,
                red_manual=req.red_manual,
                url_post_manual=req.url_post_manual,
                on_progress=_on_progress,
            )
            eventos_q.put({"type": "result", "data": result})
        except Exception as exc:
            eventos_q.put({"type": "error", "message": str(exc)})
        finally:
            eventos_q.put(None)

    threading.Thread(target=_worker, daemon=True).start()

    def _event_generator():
        while True:
            item = eventos_q.get()
            if item is None:
                break
            yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )