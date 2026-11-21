# =============================================================================
# MODERACIÓN DE IMÁGENES CON NVIDIA NIM (NEMOTRON VISION)
# =============================================================================

def moderar_imagen_evento(imagen_str: str, fiabilidad_negocio: int = 1, datos_evento: dict = None) -> dict:
    """
    MODERACIÓN DE IMAGEN CON MODELO NVIDIA NIM (Nemotron Vision-Language).
    Devuelve estado_moderacion: 'APROBADO', 'RECHAZADO' o 'PENDIENTE_MODERADOR'.
    """
    datos = datos_evento or {}
    categoria = datos.get("categoria", "Fiesta Patronal")
    titulo = datos.get("titulo") or datos.get("nombre") or ""

    res_nemotron = nemotron_classifier.clasificar_y_parsear(imagen_str, categoria, titulo)
    resultado_dict = res_nemotron.model_dump()
    resultado_dict["modelo_preentrenado"] = res_nemotron.modelo
    resultado_dict["es_llamada_ligera"] = False
    return resultado_dict

# =============================================================================
# MODERADOR IA HÍBRIDO (APRUEBA, DENIEGA O ENVÍA A PENDIENTES DEL MODERADOR)
# =============================================================================

def moderar_actividad_autonoma(datos_evento: dict) -> dict:
    """
    Evalúa integralmente una actividad (título, descripción, imagen y categoría):
    - Si hay spam, insultos o incoherencia clara -> 'denegar'
    - Si la IA tiene dudas sobre la imagen/categoría -> 'pendiente' (Panel del Moderador)
    - Si todo es coherente y claro -> 'aprobar'
    """
    titulo = datos_evento.get("titulo") or datos_evento.get("nombre") or ""
    descripcion = datos_evento.get("descripcion") or ""
    categoria = datos_evento.get("categoria") or "Fiesta Patronal"
    imagen = datos_evento.get("imagen") or ""

    # 1. Moderación del título y coherencia con la categoría (Gemini)
    res_titulo = moderar_titulo_evento(titulo, descripcion, categoria)
    if not res_titulo.get("aprobada") or not res_titulo.get("coherente_con_categoria"):
        return {
            "decision": "denegar",
            "estado_moderacion": "RECHAZADO",
            "aprobada": False,
            "requiere_revision_humana": False,
            "coherente_titulo": False,
            "coherente_imagen": True,
            "contiene_palabras_malsonantes": res_titulo.get("contiene_palabras_malsonantes", False),
            "categoria_evaluada": categoria,
            "motivo": res_titulo.get("motivo"),
            "modelo_utilizado": "gemini-2.5-flash"
        }

    # 2. Moderación de la imagen con NVIDIA NIM (Nemotron Vision + OCR)
    res_imagen = moderar_imagen_evento(imagen, 1, datos_evento)
    estado_img = res_imagen.get("estado_moderacion", "RECHAZADO")

    # 2A. Zona de duda -> Enviar a la pestaña PENDIENTES del panel del moderador
    if estado_img == "PENDIENTE_MODERADOR" or res_imagen.get("requiere_revision_humana"):
        return {
            "decision": "pendiente",
            "estado_moderacion": "PENDIENTE_MODERADOR",
            "aprobada": False,
            "requiere_revision_humana": True,
            "coherente_titulo": True,
            "coherente_imagen": False,
            "contiene_palabras_malsonantes": False,
            "categoria_evaluada": categoria,
            "sugerencia_categoria": res_imagen.get("sugerencia_categoria_alternativa"),
            "motivo": res_imagen.get("motivo"),
            "modelo_utilizado": res_imagen.get("modelo", "nvidia-nim-vision")
        }

    # 2B. Rechazo claro de imagen (ej. sandía en Turismo, cartel de otro evento, etc.)
    if not res_imagen.get("aprobada") or not res_imagen.get("coherente_con_categoria"):
        return {
            "decision": "denegar",
            "estado_moderacion": "RECHAZADO",
            "aprobada": False,
            "requiere_revision_humana": False,
            "coherente_titulo": True,
            "coherente_imagen": False,
            "contiene_palabras_malsonantes": False,
            "categoria_evaluada": categoria,
            "sugerencia_categoria": res_imagen.get("sugerencia_categoria_alternativa"),
            "motivo": res_imagen.get("motivo"),
            "modelo_utilizado": res_imagen.get("modelo", "nvidia-nim-vision")
        }

    # 3. Todo coherente -> Aprobación directa
    return {
        "decision": "aprobar",
        "estado_moderacion": "APROBADO",
        "aprobada": True,
        "requiere_revision_humana": False,
        "coherente_titulo": True,
        "coherente_imagen": True,
        "contiene_palabras_malsonantes": False,
        "categoria_evaluada": categoria,
        "motivo": f"✅ Aprobada automáticamente: Título (Gemini) e imagen (NVIDIA NIM) verificados para '{categoria}'.",
        "modelo_utilizado": f"gemini-2.5-flash + {res_imagen.get('modelo', 'nvidia-nim')}"
    }

def evaluar_evento(evento: dict, negocio: dict, historial_aprobados: list[dict]) -> dict:
    return moderar_actividad_autonoma(evento)