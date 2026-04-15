import { env } from './config/env.js'
import { app } from './app.js'
import { createServer } from 'http'
import { initSocket } from './shared/infra/socket.js'

const httpServer = createServer(app)

const io = initSocket(httpServer)
console.log('[socket] initialized', io.sockets.adapter.rooms)
io.on('connection', socket => {
  console.log('[socket] connected')
  socket.on('join', (instanceId: string) => {
    console.log('[socket] join', instanceId)
    void socket.join(instanceId)
    console.log(`[socket] joined room: ${instanceId}`)
  })

  socket.on('leave', (instanceId: string) => {
    console.log('[socket] leave', instanceId)
    void socket.leave(instanceId)
  })
})

httpServer.listen(env.port, () => {
  console.log(`API running at http://localhost:${env.port}`)
})
