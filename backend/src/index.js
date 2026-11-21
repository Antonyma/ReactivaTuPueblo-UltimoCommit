import cors from 'cors'
import express from 'express'
import { createContainer } from './config/container.js'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js'
import { createApiRouter } from './routes/index.js'

const app = express()
const container = createContainer()

app.use(cors())
app.use(express.json({ limit: '15mb' }))

app.use('/api', createApiRouter(container))

app.use(notFoundHandler)
app.use(errorHandler)

app.listen(env.port, () => {
  console.log(
    `Server listening on http://localhost:${env.port} (dataSource=${env.dataSource})`
  )
})
