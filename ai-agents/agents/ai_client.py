import os
from dotenv import load_dotenv

load_dotenv()

from google import genai
from google.genai import types
from pydantic import BaseModel

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", ""))

def generar_json(prompt: str, contenidos: list, esquema: type[BaseModel], modelo_preferido: str = None) -> dict:
    modelos = [modelo_preferido] if modelo_preferido else []
    for m in ["gemini-2.5-flash", "gemini-2.5-flash-lite"]:
        if m not in modelos:
            modelos.append(m)
    for modelo in modelos:
        try:
            resp = client.models.generate_content(
                model=modelo,
                contents=[prompt, *contenidos],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=esquema,
                    temperature=0.0,
                ),
            )
            return esquema.model_validate_json(resp.text).model_dump()
        except Exception as e:
            if modelo == modelos[-1]:
                raise e

def generar_json_con_imagen(
    prompt: str,
    imagen_bytes: bytes,
    mime_type: str,
    esquema: type[BaseModel],
    modelo_preferido: str = "gemini-2.5-flash"
) -> dict:
    """
    Usa el modelo preentrenado de visión multimodal de Gemini para analizar imágenes
    directamente desde bytes con el schema Pydantic especificado.
    """
    modelos = [modelo_preferido, "gemini-2.5-flash", "gemini-2.5-flash-lite"]
    partes = [prompt]
    if imagen_bytes:
        partes.append(types.Part.from_bytes(data=imagen_bytes, mime_type=mime_type or "image/jpeg"))

    for modelo in modelos:
        try:
            resp = client.models.generate_content(
                model=modelo,
                contents=partes,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=esquema,
                    temperature=0.0,
                ),
            )
            return esquema.model_validate_json(resp.text).model_dump()
        except Exception as e:
            if modelo == modelos[-1]:
                raise e

def extraer_bytes_imagen(imagen_str: str) -> tuple[object, str]:
    import base64
    if not imagen_str:
        return None, "image/jpeg"
    mime = "image/jpeg"
    if "base64," in imagen_str:
        partes = imagen_str.split("base64,")
        header = partes[0]
        if "data:" in header and ";" in header:
            mime = header.replace("data:", "").replace(";", "").strip()
        data_base64 = partes[1]
    else:
        data_base64 = imagen_str

    try:
        raw_bytes = base64.b64decode(data_base64)
        return raw_bytes, mime
    except Exception:
        return None, mime
