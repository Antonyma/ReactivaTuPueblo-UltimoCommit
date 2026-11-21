import os
from google import genai
from google.genai import types
from pydantic import BaseModel

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

def generar_json(prompt: str, contenidos: list, esquema: type[BaseModel]) -> dict:
    modelos = ["gemini-2.5-flash", "gemini-2.5-flash-lite"]
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