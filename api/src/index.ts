import { env } from './config/env.js'
import { app } from './app.js'
import { createServer } from 'http'
import { initSocket } from './shared/infra/socket.js'
import { apiLogger } from './shared/infra/logger.js'
import { assertInstallConfig } from './config/assert-install-config.js'

// Antes de aceitar tráfego: config de instalação faltando tem que quebrar o
// deploy, não a instalação do primeiro cliente que tentar.
assertInstallConfig()

const httpServer = createServer(app)

const io = initSocket(httpServer)
apiLogger.info('[socket] initialized')
io.on('connection', socket => {
  apiLogger.info({ socketId: socket.id }, '[socket] connected')
  socket.on('join', (instanceId: string) => {
    apiLogger.info({ socketId: socket.id, instanceId }, '[socket] join')
    void socket.join(instanceId)
    apiLogger.info({ socketId: socket.id, instanceId }, '[socket] joined room')
  })

  socket.on('leave', (instanceId: string) => {
    apiLogger.info({ socketId: socket.id, instanceId }, '[socket] leave')
    void socket.leave(instanceId)
  })
})

httpServer.listen(env.port, () => {
  apiLogger.info({ port: env.port }, 'API running')
})
