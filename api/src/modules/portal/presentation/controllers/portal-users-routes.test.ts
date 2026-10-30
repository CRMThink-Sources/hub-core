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

/** Usuários do backoffice: editar o ID do Bitrix exige sessão do portal. */
describe('rotas de usuários do backoffice sem sessão', () => {
  it('PATCH /api/portal/users/:id responde 401', async () => {
    const app = express()
    app.use('/api/portal', createPortalRoutes(createPortalAuthMiddleware()))
    const server = app.listen(0)

    try {
      const { port } = server.address() as AddressInfo
      const response = await fetch(
        `http://127.0.0.1:${port}/api/portal/users/user-1`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bitrixUserId: 42 }),
        },
      )
      expect(response.status).toBe(401)
    } finally {
      server.close()
    }
  })
})
