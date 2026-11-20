import { getHealthStatus } from '../services/healthService.js'

export function checkHealth(_req, res) {
  res.json(getHealthStatus())
}

