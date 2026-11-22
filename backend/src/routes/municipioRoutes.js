import { readFileSync } from 'node:fs'
import { Router } from 'express'

const municipiosData = JSON.parse(
  readFileSync(new URL('../data/municipios.json', import.meta.url), 'utf8')
)

const mapaCoords = Object.fromEntries(
  municipiosData.municipios.map((m) => [m.nombre, [m.lat, m.lng]])
)

export function createMunicipioRoutes() {
  const router = Router()

  router.get('/', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.status(200).json({
      ok: true,
      data: {
        centro: municipiosData.centro,
        zoom: municipiosData.zoom,
        municipios: municipiosData.municipios,
        mapaCoords,
      },
    })
  })

  return router
}

