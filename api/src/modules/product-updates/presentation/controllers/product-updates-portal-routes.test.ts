import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const { findUniqueMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn() }))

vi.mock('@/config/prisma.js', () => ({
  prisma: { productUpdate: { findUnique: findUniqueMock } },
}))
vi.mock('@/queue/redis-connection', () => ({ redisConnection: {} }))

import express from 'express'
import jwt from 'jsonwebtoken'
import type { AddressInfo } from 'node:net'
import { createPortalAuthMiddleware } from '@/modules/portal/infra/middleware/portal-auth.middleware'
import { createProductUpdatesPortalRoutes } from '../../portal-routes'

const SECRET = 'test-secret'
let baseUrl = ''
let close: () => void = () => undefined
let previousSecret: string | undefined

/** Montado como em `app.ts`: `/api/portal/novidades` atrás da sessão do portal. */
beforeAll(async () => {
  previousSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = SECRET

  const app = express()
  app.use(express.json())
  app.use(
    '/api/portal/novidades',
    createProductUpdatesPortalRoutes(createPortalAuthMiddleware()),
  )
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

beforeEach(() => findUniqueMock.mockReset())

const portalToken = () =>
  jwt.sign({ type: 'portal', portalUserId: 'portal-user-1' }, SECRET)

describe('rotas de novidades do backoffice', () => {
  it.each([
    ['GET', '/'],
    ['POST', '/'],
    ['GET', '/pu-1'],
    ['PATCH', '/pu-1'],
    ['DELETE', '/pu-1'],
    ['PUT', '/pu-1/image'],
    ['DELETE', '/pu-1/image'],
    ['POST', '/pu-1/publish'],
    ['POST', '/pu-1/publish-available'],
    ['POST', '/pu-1/publish-changes'],
    ['POST', '/pu-1/discard-changes'],
    ['POST', '/pu-1/unpublish'],
    ['POST', '/pu-1/complete'],
    ['POST', '/pu-1/reopen'],
    ['GET', '/bitrix/tasks'],
    ['GET', '/bitrix/users'],
    ['PUT', '/pu-1/task'],
    ['DELETE', '/pu-1/task'],
    ['POST', '/pu-1/task'],
  ])('%s %s sem sessão responde 401', async (method, path) => {
    const response = await fetch(`${baseUrl}/api/portal/novidades${path}`, {
      method,
    })

    expect(response.status).toBe(401)
    expect(findUniqueMock).not.toHaveBeenCalled()
  })

  it('JWT do ThinkZap (sem type portal) responde 401', async () => {
    const token = jwt.sign({ appCodeId: 'a', domainId: 'd' }, SECRET)

    const response = await fetch(`${baseUrl}/api/portal/novidades/pu-1`, {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(401)
  })

  it('/bitrix/tasks não é lido como id: termo vazio é lista vazia', async () => {
    const response = await fetch(
      `${baseUrl}/api/portal/novidades/bitrix/tasks?q=`,
      { headers: { authorization: `Bearer ${portalToken()}` } },
    )

    expect(response.status).toBe(200)
    expect(((await response.json()) as { result: unknown }).result).toEqual({
      items: [],
    })
    expect(findUniqueMock).not.toHaveBeenCalled()
  })

  it('GET /:id com sessão: 404 no formato do portal', async () => {
    findUniqueMock.mockResolvedValue(null)

    const response = await fetch(`${baseUrl}/api/portal/novidades/pu-x`, {
      headers: { authorization: `Bearer ${portalToken()}` },
    })

    expect(response.status).toBe(404)
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: 'pu-x' } })
    expect(await response.json()).toMatchObject({
      result: { error: 'Novidade não encontrada' },
    })
  })
})
