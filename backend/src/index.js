import cors from 'cors'
import express from 'express'
import { createContainer } from './config/container.js'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js'
import { createApiRouter } from './routes/index.js'

const app = express()
app.set('trust proxy', 1)
const container = createContainer()

const corsOptions =
  env.corsOrigins.length > 0
    ? {
        origin(origin, callback) {
          if (!origin || env.corsOrigins.includes(origin)) {
            return callback(null, true)
          }
          return callback(new Error('Origen no permitido por CORS'))
        },
        credentials: true,
      }
    : {}

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})

app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))

app.use('/api', createApiRouter(container))

app.use(notFoundHandler)
app.use(errorHandler)

app.listen(env.port, () => {
  console.log(
    `Server listening on http://localhost:${env.port} (dataSource=${env.dataSource})`
  )
})
