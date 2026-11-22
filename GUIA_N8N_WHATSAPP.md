# Guía rápida para poner en marcha los workflows de n8n y WhatsApp

Instancia de n8n: `https://hktn.app.n8n.cloud`  
Backend en Render: `https://pueblovivo-backend.onrender.com`

---

## 1. Estado actual de los 6 workflows

| Workflow | ID | Estado actual | Qué hace |
|---|---|---|---|
| **A - Website AI Event Chatbot** | `p98BQtHfzfUx9eOe` | ✅ **Publicado y operativo** | Chat web completo contra la API de Render (10 municipios oficiales, sesión JWT, inscripciones, valoraciones y publicación/edición de eventos). |
| **B - WhatsApp AI Event Assistant** | `Q4WRfOjNs32Kl7kJ` | ⏸️ En borrador | Asistente IA de PuebloVivo por WhatsApp + confirmación **SÍ / NO** de eventos detectados en redes sociales (`list_pending_confirmations`, `confirm_scraped_event`, `reject_scraped_event`). Listo para publicar cuando haya cuenta de WhatsApp Cloud API activa. |
| **C - Event Database Management** | `oIBFgbnXaHoElFab` | ⏸️ Sin usar (opcional) | Plantilla antigua redundante con tu propia app. **No hace falta publicarlo.** |
| **D - Event Participants & Notifications** | `GO9Ks4Oe0a7UKoGA` | ⏸️ En borrador | Dos webhooks de notificación: aviso a inscritos por cambios/cancelaciones y aviso a comercios por WhatsApp/Telegram (moderación y solicitud de confirmación **SÍ / NO** para eventos detectados en RRSS). |
| **E - Telegram AI Event Assistant** | `j4uOWp8kHj2a1e5u` | ⏸️ En borrador | Bot de Telegram con confirmación **SÍ / NO** de eventos scrapeados. Solo necesita credencial de `@BotFather` para activarlo. |
| **F - Scheduled Business Social Scraper** | `GC7LIncla9n8Mi1j` | ⏸️ En borrador | Cron cada 6 horas (`Europe/Madrid`) que llama a `POST /api/negocios/escanear-redes` para detectar ofertas/eventos nuevos en perfiles públicos de los negocios. |

---

## 2. Paso 1: Subir cambios y revisar variables de entorno

1. Haz `git add . && git commit -m "..." && git push` para que **Vercel** y **Render** tengan la última versión (chat con JWT, edición de foto en eventos, fix de logout de admin, orden de eventos y hooks de notificación en `EventoService.js`).
2. **En Vercel → Settings → Environment Variables** (comprobar que está en *Production*):
   ```env
   VITE_N8N_CHAT_WEBHOOK_URL=https://hktn.app.n8n.cloud/webhook/pueblos-events-chat
   ```
3. **En Render (backend) → Environment** (añadir cuando vayas a activar el Workflow D):
   ```env
   N8N_NOTIFY_EVENT_CHANGE_URL=https://hktn.app.n8n.cloud/webhook/pueblos-notify-event-change
   N8N_NOTIFY_BUSINESS_URL=https://hktn.app.n8n.cloud/webhook/pueblos-notify-business
   ```

---

## 3. Paso 2: Probar tu cuenta de WhatsApp (Escenario A — Si Meta ya la desbloqueó)

Ayer Meta devolvió `code: 131031` (*Business Account locked*) en tu WABA `2166731697564114`.

1. Entra en [Meta for Developers](https://developers.facebook.com/) → tu app → **WhatsApp → API Setup**.
2. Envía un mensaje de prueba (`hello_world`) a tu móvil (`+34 650 809 616`).
3. **Si llega sin error `131031`**:
   - Abre n8n y pulsa **Publish / Activate** en:
     - **`B - WhatsApp AI Event Assistant`** (`Q4WRfOjNs32Kl7kJ`)
     - **`D - Event Participants & Notifications`** (`GO9Ks4Oe0a7UKoGA`)
   - Escribe por WhatsApp al número de pruebas (`+1 555 157 3278`): *"¿Qué planes próximos hay?"* y comprueba en la pestaña **Executions** de n8n que responde la IA.

---

## 4. Paso 3: Plan B — Usar la cuenta de WhatsApp de tu compañero

Si tu cuenta sigue bloqueada con `131031`, cambiar a la cuenta de tu compañero te llevará **menos de 5 minutos**.

### A) Qué necesitas pedirle a tu compañero (desde su Meta for Developers)
1. **Para el envío de mensajes (`WhatsApp API` en n8n)**:
   - **Access Token** (token temporal de 24h desde *API Setup*, o mejor un token permanente de *System User*).
   - **Business Account ID (WABA ID)**.
   - **Phone Number ID** de su número de pruebas (es un número largo, p. ej. en tu cuenta era `1484578241404353`).
2. **Para recibir mensajes (`WhatsApp OAuth API` en n8n)**:
   - **Client ID** (= *App ID* en *App Settings → Basic*).
   - **Client Secret** (= *App Secret* en *App Settings → Basic*).
3. **Añadir tu teléfono como destinatario de prueba**:
   - En su panel de Meta → **WhatsApp → API Setup → To → Manage phone number list**, que añada tu número (`+34 650 809 616`) y tú le pasas el código de verificación que te llega por WhatsApp. *(En modo desarrollo, Meta solo deja enviar mensajes a los números de esa lista).*

### B) Crear las 2 credenciales nuevas en n8n
En n8n → **Credentials → Add Credential**:
1. **`WhatsApp API`** → nómbrala por ejemplo `WhatsApp Compañero` → pega su **Access Token** y **Business Account ID**.
2. **`WhatsApp OAuth API`** → nómbrala por ejemplo `WhatsApp OAuth Compañero` → pega su **Client ID (App ID)** y **Client Secret (App Secret)**.

### C) Actualizar los nodos en n8n (son solo 2 workflows)
1. **En `B - WhatsApp AI Event Assistant` (`Q4WRfOjNs32Kl7kJ`)**:
   - Nodo **`WhatsApp Message Received`** (trigger): cambia la credencial a `WhatsApp OAuth Compañero`.
   - Nodos **`Send WhatsApp Reply`**, **`Send Fallback Message`** y **`Send Text-Only Notice`**: cambia la credencial a `WhatsApp Compañero`.
   - *(En `Send WhatsApp Reply` el `phoneNumberId` ya es dinámico `{{ $('Extract Message').item.json.phone_number_id }}`, así que se adapta solo. Revisa si `Send Fallback Message` o `Send Text-Only Notice` tienen un `phoneNumberId` fijo y cámbialo al del compañero o a la misma expresión).*
   - Pulsa **Save** y **Publish / Activate**.

2. **En `D - Event Participants & Notifications` (`GO9Ks4Oe0a7UKoGA`)**:
   - Nodo **`Send Attendee WhatsApp`**: cambia la credencial a `WhatsApp Compañero` y sustituye **Phone Number ID** (`1484578241404353`) por el **Phone Number ID** de tu compañero.
   - Nodo **`Send Business WhatsApp`**: igual (credencial `WhatsApp Compañero` + **Phone Number ID** de tu compañero).
   - Pulsa **Save** y **Publish / Activate**.

> **Nota sobre el webhook de recepción**: al publicar Workflow B, n8n intenta registrar el webhook automáticamente en Meta. Si al escribirle al bot no entra ninguna ejecución en n8n, abre el nodo `WhatsApp Message Received`, copia su **Production URL**, pégala en el panel de Meta de tu compañero (**WhatsApp → Configuration → Webhook Callback URL**) y verifica que esté suscrito al campo **`messages`**.

---

## 5. Cómo llamar al Workflow D desde tus scrapers de redes sociales

Cuando tu scraper detecte un evento en redes sociales de un comercio y cree su perfil/evento en PuebloVivo, haz un `POST` a:

```text
POST https://hktn.app.n8n.cloud/webhook/pueblos-notify-business
Content-Type: application/json
```

Ejemplo en Python (para pegar directo en tu scraper):

```python
import requests

requests.post(
    "https://hktn.app.n8n.cloud/webhook/pueblos-notify-business",
    json={
        "negocioNombre": "Bar El Mirador",
        "propietarioTelefono": "34650809616",  # acepta 9 dígitos o con prefijo 34
        "eventoNombre": "Noche de Tapas y Música",
        "pueblo": "Senés",
        "origen": "redes_sociales",
        "perfilCreado": True,   # True si acabas de crear su perfil; False si ya existía
        "redSocial": "Instagram",
        "urlWeb": "https://tu-web.vercel.app",
    },
    timeout=10,
)
```

---

## 6. Pendiente para activar el Scraping de Redes Sociales + Confirmación (WhatsApp / Telegram)

La lógica en `ai-agents`, `backend`, `frontend` y los workflows de n8n ya está implementada. Solo quedan estos pasos de configuración/credenciales:

### A) Despliegue y variables de entorno (Render + Vercel)
1. Haz `git add . && git commit -m "feat: scraping gratuito RRSS y confirmacion WhatsApp/Telegram" && git push` para desplegar los últimos cambios en **Render** y **Vercel**.
2. En **Render (`pueblovivo-backend`) → Environment**, verifica que existan:
   ```env
   N8N_NOTIFY_BUSINESS_URL=https://hktn.app.n8n.cloud/webhook/pueblos-notify-business
   AI_AGENTS_URL=https://pueblovivo-ai-agents.onrender.com
   WHATSAPP_VERIFY_TOKEN=dev_whatsapp_token
   ```
   *(Si defines `AI_AGENTS_API_KEY` en ambos servicios de Render, úsala también en el Paso B de abajo; si no la defines, el cron acepta `WHATSAPP_VERIFY_TOKEN`.)*
3. En **Render (`pueblovivo-ai-agents`) → Environment**, comprueba que haya **al menos una API key gratuita** configurada (el router rota automáticamente entre ellas si alguna llega a límite de cuota):
   - `GEMINI_API_KEY` (Google AI Studio — `gemini-2.5-flash` / `gemini-2.5-flash-lite`)
   - `NVIDIA_API_KEY` (NVIDIA NIM — `meta/llama-3.3-70b-instruct`)
   - `OPENROUTER_API_KEY` (OpenRouter Free — `openrouter/free`)

### B) Configurar credencial y activar Workflow F (Cron cada 6h)
1. Abre **n8n → Credentials → Add Credential → Custom Auth (`httpTemplatedCustomAuth`)** y nómbrala `PuebloVivo Scraper API Key`.
2. Pega este JSON sustituyendo el valor por tu `AI_AGENTS_API_KEY` (o `dev_whatsapp_token` si no pusiste `AI_AGENTS_API_KEY`):
   ```json
   {
     "headers": {
       "X-API-Key": "dev_whatsapp_token"
     }
   }
   ```
3. Abre **`F - Scheduled Business Social Scraper`** (`GC7LIncla9n8Mi1j`) → nodo **`Scan Business Socials API`** → selecciona la credencial `PuebloVivo Scraper API Key` → **Save** y **Publish / Activate**.

### C) Credenciales de WhatsApp y/o Telegram en n8n
- **WhatsApp**: sigue los **Pasos 2 o 3** de arriba para asignar una cuenta de Meta sin error `131031` en:
  - **`B - WhatsApp AI Event Assistant`** (`Q4WRfOjNs32Kl7kJ`) y publicar.
  - **`D - Event Participants & Notifications`** (`GO9Ks4Oe0a7UKoGA`) y publicar.
- **Telegram (opcional, si quieres usarlo junto a WhatsApp)**:
  1. Crea un bot en Telegram hablando con `@BotFather` (`/newbot`) y copia el **Bot Token**.
  2. En **n8n → Credentials → Add Credential → Telegram API**, pega el token.
  3. Asigna esa credencial en:
     - **`E - Telegram AI Event Assistant`** (`j4uOWp8kHj2a1e5u`): nodos `Telegram Message Received`, `Send Telegram Reply`, `Send Fallback Message`, `Send Text-Only Notice` → **Save** y **Publish / Activate**.
     - **`D - Event Participants & Notifications`** (`GO9Ks4Oe0a7UKoGA`): nodo `Send Business Telegram` → **Save** y **Publish / Activate**.
- **Nota si cambias `WHATSAPP_VERIFY_TOKEN` en producción**: actualiza la cabecera `x-whatsapp-token` en los nodos `list_pending_confirmations`, `confirm_scraped_event` y `reject_scraped_event` de los workflows **B** y **E**.

### D) Comprobación opcional en Supabase (solo si `evento.estado` es un ENUM)
Si en tu tabla `public.evento` la columna `estado` es de tipo `text`, no necesitas hacer nada. Si te diera un error de Postgres tipo `invalid input value for enum ...`, ejecuta en el **SQL Editor de Supabase**:
```sql
ALTER TYPE estado_evento ADD VALUE IF NOT EXISTS 'pendiente_confirmacion';
ALTER TYPE estado_evento ADD VALUE IF NOT EXISTS 'descartada';
```

---

## 7. Checklist rápido antes de la demo

- [ ] **Chat Web (Workflow A)**: preguntar *"¿Qué planes próximos hay?"*, *"¿A qué planes estoy apuntado?"* (logueado) y probar una inscripción con confirmación.
- [ ] **Info de pueblos**: preguntar *"Cuéntame sobre Senés y cómo llegar"* (comprobar que ejecutaste el `GRANT SELECT` y el `DELETE` de los 4 pueblos fuera de la Mancomunidad en Supabase).
- [ ] **WhatsApp Bot (Workflow B)**: enviar un mensaje desde tu móvil al número activo (tuyo o del compañero) y verificar respuesta en menos de 5 s.
- [ ] **Notificaciones (Workflow D)**: lanzar una prueba al webhook `pueblos-notify-business` (desde el scraper o `curl`) y editar la hora de un evento con al menos 1 inscrito para comprobar que llega el WhatsApp.
- [ ] **Scraping RRSS + Confirmación (Workflows B, D, E, F)**:
  - Entrar como **Publicador** en un negocio con URLs públicas → pulsar **"Buscar eventos en mis redes"**.
  - Comprobar que el evento nuevo aparece como *"Confirma por WhatsApp/Telegram"* (oculto al público) y que volver a pulsar el botón **no crea duplicados**.
  - Responder **"SÍ"** en WhatsApp o Telegram → comprobar que pasa por moderación IA (`aprobada` o `pendiente` en `ModeratorPanel`).
  - Probar a responder **"NO"** con otro evento → comprobar que pasa a `descartada` y no vuelve a sugerirse al re-escanear.

