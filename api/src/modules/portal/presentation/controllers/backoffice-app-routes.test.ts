import { describe, expect, it, vi } from 'vitest'

vi.mock('@/config/prisma.js', () => ({ prisma: {} }))
vi.mock('@/queue/redis-connection', () => ({ redisConnection: {} }))
// As rotas do portal montam o reprocessamento de "Falhas de envio", que fala com o BullMQ.
vi.mock(
  '@/modules/thinkzap/infra/queue/bullmq-open-channel-conversation.queue',
  () => ({ BullMqWidgetSendQueue: class {} }),
)

import express from 'express'
import type { AddressInfo } from 'node:net'
import { createPortalAuthMiddleware } from '../../infra/middleware/portal-auth.middleware'
import { createPortalRoutes } from '../../routes'

/** Rotas do backoffice de clientes e aplicações: nenhuma responde sem sessão. */
describe('rotas de aplicação do backoffice sem sessão', () => {
  it.each([
    ['GET', '/api/portal/apps/app-1'],
    ['POST', '/api/portal/apps/app-1/link-mirror'],
    ['POST', '/api/portal/apps/app-1/subscriptions/sub-1/activate'],
    ['POST', '/api/portal/apps/app-1/subscriptions/sub-1/deactivate'],
    ['POST', '/api/portal/apps/app-1/subscriptions/sub-1/subscribe-lines'],
  ])('%s %s responde 401', async (method, path) => {
    const app = express()
    app.use('/api/portal', createPortalRoutes(createPortalAuthMiddleware()))
    const server = app.listen(0)

    try {
      const { port } = server.address() as AddressInfo
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        method,
      })
      expect(response.status).toBe(401)
    } finally {
      server.close()
    }
  })
})
