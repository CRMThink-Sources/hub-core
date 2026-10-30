import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const { findManyMock } = vi.hoisted(() => ({ findManyMock: vi.fn() }))

vi.mock('@/config/prisma.js', () => ({
  prisma: { productUpdate: { findMany: findManyMock } },
}))
// As rotas do ThinkZap importam filas do BullMQ, criadas na carga do módulo.
vi.mock('@/queue/redis-connection', () => ({
  redisConnection: {},
  bullBaseOptions: {},
}))
vi.mock('bullmq', async importOriginal => {
  class Stub {
    on() {
      return this
    }
  }
  return {
    ...(await importOriginal<object>()),
    Queue: Stub,
    Worker: Stub,
    QueueEvents: Stub,
  }
})
// O acesso ao app (allow-list no banco) tem testes próprios; aqui só deixa passar
// para provar que a rota existe atrás do JWT.
vi.mock(
  '@/modules/thinkzap/infra/middleware/thinkzap-access.middleware',
  async importOriginal => ({
    ...(await importOriginal<object>()),
    thinkzapAccessMiddleware: (
      _req: unknown,
      _res: unknown,
      next: () => void,
    ) => next(),
  }),
)

import express from 'express'
import jwt from 'jsonwebtoken'
import type { AddressInfo } from 'node:net'
import { createAuthMiddleware } from '@/middleware/auth'
import { createThinkerszapRoutes } from '@/modules/thinkzap/routes'
import {
  buildProductUpdate,
  completeProductUpdateContent,
} from '../../infra/persistence/in-memory-product-update.repository.fake'

const SECRET = 'test-secret'
let baseUrl = ''
let close: () => void = () => undefined
let previousSecret: string | undefined

/** Montado como em `app.ts`: `/api/thinkzap` atrás do `authMiddleware`. */
beforeAll(async () => {
  previousSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = SECRET

  const app = express()
  app.use('/api/thinkzap', createAuthMiddleware(), createThinkerszapRoutes())
  await new Promise<void>(resolve => {
    const server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
      close = () => server.close()
      resolve()
    })
  })
})

afterAll(() => {
  close()
  process.env.JWT_SECRET = previousSecret
})

const get = (headers: Record<string, string> = {}) =>
  fetch(`${baseUrl}/api/thinkzap/novidades?locale=es`, { headers })

describe('GET /api/thinkzap/novidades', () => {
  it('sem autenticação responde 401', async () => {
    const response = await get()

    expect(response.status).toBe(401)
    expect(findManyMock).not.toHaveBeenCalled()
  })

  it('token inválido responde 401', async () => {
    const response = await get({ authorization: 'Bearer nao-e-um-jwt' })

    expect(response.status).toBe(401)
    expect(findManyMock).not.toHaveBeenCalled()
  })

  it('com o JWT do ThinkZap devolve as novidades publicadas', async () => {
    const published = buildProductUpdate({
      visibility: 'PUBLISHED',
      publishedContent: completeProductUpdateContent(),
      publishedAt: new Date('2026-10-05T12:00:00.000Z'),
    })
    findManyMock.mockResolvedValue([published])
    const token = jwt.sign(
      { appCodeId: 'app-code', domainId: 'domain-1', bitrixUserId: '7' },
      SECRET,
    )

    const response = await get({ authorization: `Bearer ${token}` })

    expect(response.status).toBe(200)
    expect(findManyMock).toHaveBeenCalledWith({
      where: { visibility: 'PUBLISHED' },
    })
    const body = (await response.json()) as { result: unknown }
    expect(body.result).toEqual({
      items: [
        {
          id: 'pu-1',
          title: 'Envío de plantilla',
          description: 'Ahora con imagen.',
          imageUrl: null,
          status: 'soon',
        },
      ],
    })
  })
})
