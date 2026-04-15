import { Server } from 'socket.io'
import type { Server as HttpServer } from 'http'

let _io: Server | null = null

export function initSocket(httpServer: HttpServer): Server {
  _io = new Server(httpServer, {
    cors: { origin: true },
    path: '/api/socket.io',
  })
  return _io
}

export function getIo(): Server {
  if (!_io) throw new Error('Socket.IO not initialized. Call initSocket first.')
  return _io
}
