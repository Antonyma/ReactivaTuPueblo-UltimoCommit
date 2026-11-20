# ReactivaTuPueblo-UltimoCommit

Monorepo del proyecto **ReactivaTuPueblo** con frontend en React + Vite y backend en Node.js + Express.

## Estructura

```text
ReactivaTuPueblo-UltimoCommit/
├── backend/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── config/
│       ├── controllers/
│       ├── middlewares/
│       ├── models/
│       ├── routes/
│       └── services/
├── frontend/
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── api/
│       ├── assets/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── App.jsx
│       ├── index.css
│       └── main.jsx
├── .env.example
├── .gitignore
└── package.json
```

## Requisitos previos

- Node.js y npm instalados.

## Instalación

Desde la raíz del repositorio:

```bash
npm install
```

Opcionalmente, copia los archivos de entorno de ejemplo antes de arrancar:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## Arranque en desarrollo

Para iniciar backend y frontend simultáneamente:

```bash
npm run dev
```

También puedes arrancarlos por separado:

```bash
npm run dev:backend
npm run dev:frontend
```

- **Backend**: `http://localhost:3000` (health check en `GET /api/health`)
- **Frontend**: `http://localhost:5173`

