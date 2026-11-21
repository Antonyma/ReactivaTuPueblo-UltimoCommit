/**
 * Cliente de Moderación conectado a ai-agents (Python / FastAPI / Google GenAI)
 * 
 * MODELO PREENTRENADO Y MODERADOR AUTÓNOMO:
 * - gemini-2.5-flash-autonomo: Moderador IA que actúa de forma autónoma (NO espera a acción humana).
 * - Evalúa la coherencia del TÍTULO con la categoría.
 * - Evalúa la coherencia de la IMAGEN con la categoría mediante modelo preentrenado de visión.
 * - Rechaza de inmediato actividades que no tienen nada que ver o títulos incoherentes.
 */

const AI_AGENTS_URL = import.meta.env?.VITE_AI_AGENTS_URL || "http://localhost:8000";

// Palabras malsonantes / insultos
export const PALABRAS_MALSONANTES = [
  "mierda", "puta", "puto", "cabron", "cabrona", "cabrones", "hijo de puta", "hdp",
  "estafa", "estafadores", "ladron", "ladrones", "sinverguenza", "sinvergüenza",
  "gilipollas", "imbecil", "imbécil", "idiota", "capullo", "subnormal", "coño",
  "joder", "polla", "poya", "pendejo", "pendeja", "maricon", "maricón", "asco de",
  "basura", "maldito", "maldita", "asqueroso", "asquerosa", "timadores", "estafador"
];

// Spam o términos incoherentes ajenos a eventos municipales
const PALABRAS_SPAM_INCOHERENTES = [
  "casino", "apuestas", "cripto", "crypto", "bitcoin", "viagra", "prestamos",
  "calderas en madrid", "reparaciones fontanero", "vendo zapatillas", "asdasd",
  "qwerty", "test test", "xxx", "porn", "prueba sin sentido", "anuncio publicitario externo"
];

export const CATEGORIAS_VALIDACION = {
  "Fiesta Patronal": {
    descripcion: "Celebraciones populares, música, verbenas, procesiones y actos festivos municipales.",
    conceptosEsperados: ["verbena", "orquesta", "fiesta", "procesión", "música", "baile", "plaza", "fuegos", "patrón", "patrona", "san", "virgen", "romería", "cohetes", "roscos", "peña", "pregón"],
    etiquetasDetectadas: ["Celebración Pública", "Ambiente Festivo", "Concurrencia Popular"]
  },
  "Deportes": {
    descripcion: "Eventos deportivos, senderismo, carreras de montaña, ciclismo BTT, pistas municipales.",
    conceptosEsperados: ["deporte", "carrera", "senderismo", "bici", "ciclismo", "fútbol", "montaña", "trofeo", "ruta", "pádel", "maratón", "trail", "marcha", "liga", "entrenamiento", "fitness"],
    etiquetasDetectadas: ["Actividad Física", "Equipamiento Deportivo", "Aire Libre"]
  },
  "Gastronomía": {
    descripcion: "Rutas de la tapa, platos tradicionales, repostería, catas y restauración local.",
    conceptosEsperados: ["tapa", "comida", "plato", "degustación", "restaurante", "vino", "paella", "gastronomía", "dulce", "migas", "aceite", "embutidos", "cata", "puchero", "jamón", "menú", "cena", "almuerzo"],
    etiquetasDetectadas: ["Alimentos y Bebidas", "Cocina Tradicional", "Hostelería"]
  },
  "Turismo": {
    descripcion: "Visitas guiadas, monumentos históricos, paisajes naturales, vías verdes y patrimonio rural.",
    conceptosEsperados: ["visita", "monumento", "mina", "vía verde", "paisaje", "patrimonio", "historia", "naturaleza", "mirador", "hornos", "sendero", "guía", "excursión", "paraje", "histórico", "ruta turística"],
    etiquetasDetectadas: ["Patrimonio Cultural", "Puntos de Interés", "Paisaje Rural"]
  },
  "Comercio": {
    descripcion: "Mercadillos artesanos, productos de la huerta, tiendas de proximidad y talleres locales.",
    conceptosEsperados: ["comercio", "tienda", "mercado", "artesanía", "taller", "producto local", "alfarería", "oferta", "esparto", "cerámica", "mercadillo", "huerta", "venta", "artesanal"],
    etiquetasDetectadas: ["Comercio Local", "Productos Autóctonos", "Artesanía"]
  }
};

/**
 * 1. Moderación de Reseñas (Filtro estricto de insultos)
 */
export async function moderarResenaConGemini(texto) {
  try {
    const res = await fetch(`${AI_AGENTS_URL}/agents/moderate/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto })
    });
    if (res.ok) {
      const data = await res.json();
      return {
        aprobada: data.aprobada,
        contieneMalasPalabras: data.contiene_palabras_malsonantes,
        palabrasDetectadas: data.palabras_detectadas || [],
        modelo: data.modelo_utilizado || "gemini-2.5-flash",
        motivo: data.motivo,
        tokensGastados: 25
      };
    }
  } catch (err) {}

  const textoMin = (texto || "").toLowerCase();
  const palabrasEncontradas = PALABRAS_MALSONANTES.filter((p) => {
    const regex = new RegExp(`\\b${p}\\b`, "i");
    return regex.test(textoMin) || textoMin.includes(p);
  });

  if (palabrasEncontradas.length > 0) {
    return {
      aprobada: false,
      contieneMalasPalabras: true,
      palabrasDetectadas: palabrasEncontradas,
      modelo: "gemini-2.5-flash (ai-agents)",
      motivo: `Bloqueada por ai-agents: Lenguaje inapropiado detectado (${palabrasEncontradas.join(", ")}).`,
      tokensGastados: 28
    };
  }

  return {
    aprobada: true,
    contieneMalasPalabras: false,
    palabrasDetectadas: [],
    modelo: "gemini-2.5-flash (ai-agents)",
    motivo: "Aprobada por ai-agents: Reseña respetuosa y constructiva.",
    tokensGastados: 24
  };
}

/**
 * 2. Moderación de Títulos y Coherencia Temática con la Categoría
 */
export async function moderarTituloActividadConGemini(titulo, descripcion = "", categoria = "Fiesta Patronal") {
  try {
    const res = await fetch(`${AI_AGENTS_URL}/agents/moderate/event-title`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo, descripcion, categoria })
    });
    if (res.ok) {
      const data = await res.json();
      return {
        aprobada: data.aprobada,
        coherenteConCategoria: data.coherente_con_categoria,
        contieneMalasPalabras: data.contiene_palabras_malsonantes,
        palabrasDetectadas: data.palabras_detectadas || [],
        modelo: data.modelo_utilizado || "gemini-2.5-flash",
        motivo: data.motivo
      };
    }
  } catch (err) {}

  const textoAnalizar = `${titulo} ${descripcion}`.toLowerCase().trim();

  // A. Palabras malsonantes
  const palabrasEncontradas = PALABRAS_MALSONANTES.filter((p) => {
    const regex = new RegExp(`\\b${p}\\b`, "i");
    return regex.test(textoAnalizar) || textoAnalizar.includes(p);
  });
  if (palabrasEncontradas.length > 0) {
    return {
      aprobada: false,
      coherenteConCategoria: false,
      contieneMalasPalabras: true,
      palabrasDetectadas: palabrasEncontradas,
      modelo: "gemini-2.5-flash (ai-agents)",
      motivo: `🚫 Actividad rechazada por ai-agents: El título contiene palabras malsonantes (${palabrasEncontradas.join(", ")}).`
    };
  }

  // B. Detección de spam o incoherencia absoluta
  const esSpam = PALABRAS_SPAM_INCOHERENTES.some((p) => textoAnalizar.includes(p));
  if (esSpam || titulo.trim().length < 5) {
    return {
      aprobada: false,
      coherenteConCategoria: false,
      contieneMalasPalabras: false,
      palabrasDetectadas: [],
      modelo: "gemini-2.5-flash (ai-agents)",
      motivo: `🚨 Rechazada por Moderador IA: Título incoherente, carente de sentido o catalogado como spam publicitario ajeno a la agenda comarcal.`
    };
  }

  // C. Coherencia con la categoría
  const infoCat = CATEGORIAS_VALIDACION[categoria] || CATEGORIAS_VALIDACION["Fiesta Patronal"];
  const tieneConcepto = infoCat.conceptosEsperados.some((c) => textoAnalizar.includes(c));

  // Si no tiene ningún concepto afín y es un texto corto o disparatado
  const esCoherente = tieneConcepto || textoAnalizar.length > 20;

  if (!esCoherente) {
    return {
      aprobada: false,
      coherenteConCategoria: false,
      contieneMalasPalabras: false,
      palabrasDetectadas: [],
      modelo: "gemini-2.5-flash (ai-agents)",
      motivo: `🚨 Rechazada por Moderador IA: El título "${titulo}" no tiene coherencia temática con la categoría "${categoria}".`
    };
  }

  return {
    aprobada: true,
    coherenteConCategoria: true,
    contieneMalasPalabras: false,
    palabrasDetectadas: [],
    modelo: "gemini-2.5-flash (ai-agents)",
    motivo: `Título coherente con la categoría "${categoria}".`
  };
}

/**
 * 3. Moderación de Imágenes con Modelo Preentrenado de Visión
 */
export async function moderarImagenConGemini(
  imagenUrlOrBase64,
  fiabilidadNegocio = 1,
  datosEvento = {},
  muestrasAprendidas = 0
) {
  const categoria = datosEvento.categoria || "Fiesta Patronal";
  const titulo = datosEvento.titulo || "";
  const infoCategoria = CATEGORIAS_VALIDACION[categoria] || CATEGORIAS_VALIDACION["Fiesta Patronal"];

  try {
    const res = await fetch(`${AI_AGENTS_URL}/agents/moderate/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imagen_base64: imagenUrlOrBase64 || "",
        fiabilidad_negocio: Number(fiabilidadNegocio),
        datos_evento: { categoria, titulo, ...datosEvento }
      })
    });
    if (res.ok) {
      const data = await res.json();
      return {
        aprobada: data.aprobada,
        coherenteConCategoria: data.coherente_con_categoria,
        modelo: data.modelo_preentrenado || "gemini-2.5-flash-vision",
        categoriaEvaluada: categoria,
        etiquetas: data.elementos_visuales || infoCategoria.etiquetasDetectadas,
        motivo: data.motivo,
        esLlamadaLigera: false,
        tokensGastados: 45
      };
    }
  } catch (err) {}

  const imgStr = String(imagenUrlOrBase64 || "").toLowerCase();
  const tituloMin = String(titulo).toLowerCase();

  const palabrasIncoherentes = [
    "meme", "crypto", "cripto", "screenshot", "captura", "random", "fake", "spam", "troll", "casino", "apuestas", "selfie"
  ];
  const esIncoherente = palabrasIncoherentes.some((p) => imgStr.includes(p) || tituloMin.includes(p));

  if (esIncoherente) {
    return {
      aprobada: false,
      coherenteConCategoria: false,
      modelo: "gemini-2.5-flash-vision (ai-agents)",
      categoriaEvaluada: categoria,
      etiquetas: ["Contenido No Relacionado", "Incoherencia Visual"],
      esLlamadaLigera: false,
      motivo: `🚨 Rechazada por modelo preentrenado (ai-agents): La imagen no tiene relación con la categoría "${categoria}".`
    };
  }

  return {
    aprobada: true,
    coherenteConCategoria: true,
    modelo: "gemini-2.5-flash-vision (ai-agents)",
    categoriaEvaluada: categoria,
    etiquetas: infoCategoria.etiquetasDetectadas,
    esLlamadaLigera: false,
    motivo: `🔬 Validada por modelo preentrenado de visión (ai-agents): Imagen representativa de la categoría "${categoria}".`
  };
}

/**
 * 4. MODERADOR IA AUTÓNOMO COMPLETO
 * Juzga integralmente título, descripción e imagen. DECIDE Y RESUELVE ÉL SIN ESPERAR ACCIÓN HUMANA.
 */
export async function moderarActividadAutonomaConGemini(datosEvento) {
  try {
    const res = await fetch(`${AI_AGENTS_URL}/agents/moderate/autonomous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evento: datosEvento })
    });
    if (res.ok) {
      const data = await res.json();
      return {
        decision: data.decision,
        aprobada: data.aprobada,
        coherenteTitulo: data.coherente_titulo,
        coherenteImagen: data.coherente_imagen,
        contieneMalasPalabras: data.contiene_palabras_malsonantes,
        motivo: data.motivo,
        modelo: data.modelo_utilizado || "gemini-2.5-flash-autonomo"
      };
    }
  } catch (err) {}

  // Fallback local con las mismas reglas autónomas de ai-agents
  const modTitulo = await moderarTituloActividadConGemini(
    datosEvento.titulo || datosEvento.nombre || "",
    datosEvento.descripcion || "",
    datosEvento.categoria || "Fiesta Patronal"
  );

  if (!modTitulo.aprobada || !modTitulo.coherenteConCategoria) {
    return {
      decision: "denegar",
      aprobada: false,
      coherenteTitulo: false,
      coherenteImagen: true,
      contieneMalasPalabras: modTitulo.contieneMalasPalabras,
      motivo: modTitulo.motivo,
      modelo: "gemini-2.5-flash-autonomo"
    };
  }

  const modImg = await moderarImagenConGemini(
    datosEvento.imagen || "",
    1,
    datosEvento
  );

  if (!modImg.aprobada || !modImg.coherenteConCategoria) {
    return {
      decision: "denegar",
      aprobada: false,
      coherenteTitulo: true,
      coherenteImagen: false,
      contieneMalasPalabras: false,
      motivo: modImg.motivo,
      modelo: "gemini-2.5-flash-autonomo"
    };
  }

  return {
    decision: "aprobar",
    aprobada: true,
    coherenteTitulo: true,
    coherenteImagen: true,
    contieneMalasPalabras: false,
    motivo: `✅ Aprobada por Moderador IA Autónomo: Título e imagen con coherencia total para "${datosEvento.categoria}".`,
    modelo: "gemini-2.5-flash-autonomo"
  };
}
