import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { errorHandler } from './middlewares/errorHandler.js'
import healthRoutes from './routes/healthRoutes.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/health', healthRoutes)

app.use(errorHandler)

app.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`)
})

