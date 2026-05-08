import { env } from './config/env.js'
import { app } from './app.js'
import { createServer } from 'http'
import { initSocket } from './shared/infra/socket.js'
import { logger } from './shared/infra/logger.js'

const httpServer = createServer(app)

const io = initSocket(httpServer)
logger.info('[socket] initialized')
io.on('connection', socket => {
  logger.info({ socketId: socket.id }, '[socket] connected')
  socket.on('join', (instanceId: string) => {
    logger.info({ socketId: socket.id, instanceId }, '[socket] join')
    void socket.join(instanceId)
    logger.info({ socketId: socket.id, instanceId }, '[socket] joined room')
  })

  socket.on('leave', (instanceId: string) => {
    logger.info({ socketId: socket.id, instanceId }, '[socket] leave')
    void socket.leave(instanceId)
  })
})

httpServer.listen(env.port, () => {
  logger.info({ port: env.port }, 'API running')
})
