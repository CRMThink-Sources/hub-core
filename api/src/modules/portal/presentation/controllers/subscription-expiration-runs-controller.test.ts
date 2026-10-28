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
import {
  crmOriginFromWebhook,
  GetSubscriptionExpirationRun,
  ListSubscriptionExpirationRuns,
} from '../../application/subscription-expiration-runs'
import { StartManualSubscriptionExpiration } from '@/modules/application/application/start-manual-subscription-expiration'
import { SubscriptionExpirationRun } from '@/modules/application/domain/entities/subscription-expiration-run'
import {
  GetSubscriptionExpirationRunController,
  ListSubscriptionExpirationRunsController,
  StartSubscriptionExpirationRunController,
} from './subscription-expiration-runs-controller'

const NOW = new Date('2026-10-13T12:00:00Z')

const run = (
  overrides: Partial<SubscriptionExpirationRun> = {},
): SubscriptionExpirationRun => ({
  id: 'run-1',
  trigger: 'scheduled',
  triggeredBy: null,
  status: 'success',
  startedAt: new Date('2026-10-13T11:00:00Z'),
  finishedAt: new Date('2026-10-13T11:00:04Z'),
  checked: 2,
  trialExpired: 1,
  pastDue: 0,
  failed: 0,
  linesUnsubscribed: 0,
  cancelled: 0,
  linesChecked: 0,
  linesSubscribed: 0,
  reconciliation: false,
  providerStepsSkipped: false,
  paused: false,
  error: null,
  ...overrides,
})

describe('ListSubscriptionExpirationRunsController', () => {
  const make = (runs: SubscriptionExpirationRun[] = [run()]) => {
    const list = vi.fn().mockResolvedValue({ runs, total: 41 })
    return {
      controller: new ListSubscriptionExpirationRunsController(
        new ListSubscriptionExpirationRuns({ list }, () => NOW),
      ),
      list,
    }
  }

  it('valida e repassa paginação e filtros', async () => {
    const { controller, list } = make()

    const response = await controller.perform(
      {
        query: {
          page: '2',
          limit: '20',
          trigger: 'manual',
          onlyWithChanges: 'true',
        },
      } as never,
      {} as never,
    )

    expect(response.status).toBe(200)
    expect(list).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      trigger: 'manual',
      onlyWithChanges: true,
    })
    expect(response.result).toMatchObject({
      meta: { total: 41, page: 2, limit: 20, totalPages: 3 },
    })
  })

  it('recusa limit acima de 100 e trigger desconhecido', async () => {
    const { controller } = make()

    for (const query of [{ limit: '101' }, { trigger: 'cron' }]) {
      const response = await controller.perform({ query } as never, {} as never)
      expect(response.status).toBe(400)
    }
  })

  it('calcula duração e marca running com mais de 1h como abandonada', async () => {
    const { controller } = make([
      run(),
      run({
        id: 'run-2',
        status: 'running',
        finishedAt: null,
        startedAt: new Date('2026-10-13T10:30:00Z'),
      }),
      run({
        id: 'run-3',
        status: 'running',
        finishedAt: null,
        startedAt: new Date('2026-10-13T11:50:00Z'),
      }),
    ])

    const response = await controller.perform(
      { query: {} } as never,
      {} as never,
    )
    const { runs } = response.result as {
      runs: Array<{ id: string; abandoned: boolean; durationMs: number | null }>
    }

    expect(runs.map(r => [r.id, r.abandoned, r.durationMs])).toEqual([
      ['run-1', false, 4000],
      ['run-2', true, null],
      ['run-3', false, null],
    ])
  })
})

describe('GetSubscriptionExpirationRunController', () => {
  const periodEnd = new Date('2026-10-12T23:59:59.999Z')

  it('devolve 404 para rodada desconhecida', async () => {
    const controller = new GetSubscriptionExpirationRunController(
      new GetSubscriptionExpirationRun(
        { findById: vi.fn().mockResolvedValue(null) },
        'https://crm.example.com',
        1142,
      ),
    )

    const response = await controller.perform(
      { params: { id: 'x' } } as never,
      {} as never,
    )

    expect(response.status).toBe(404)
  })

  it('monta o link do CRM só com a origem do webhook', async () => {
    const origin = crmOriginFromWebhook(
      'https://crm.example.com/rest/1/s3cr3t-token/',
    )
    const controller = new GetSubscriptionExpirationRunController(
      new GetSubscriptionExpirationRun(
        {
          findById: vi.fn().mockResolvedValue({
            ...run(),
            changes: [
              {
                kind: 'status',
                subscriptionId: '501',
                from: 'trialing',
                to: 'trial_expired',
                periodEnd,
                succeeded: true,
              },
              {
                kind: 'line-unsubscribed',
                subscriptionId: '502',
                itemId: '9001',
                provider: 'ZAPI',
                from: null,
                to: null,
                periodEnd,
                succeeded: true,
              },
            ],
          }),
        },
        origin,
        1142,
        () => NOW,
      ),
    )

    const response = await controller.perform(
      { params: { id: 'run-1' } } as never,
      {} as never,
    )
    const body = response.result as {
      changes: Array<{ crmUrl: string; itemCrmUrl: string | null }>
    }

    expect(response.status).toBe(200)
    expect(body.changes[0]?.crmUrl).toBe(
      'https://crm.example.com/crm/type/1142/details/501/',
    )
    expect(body.changes[0]?.itemCrmUrl).toBeNull()
    expect(body.changes[1]?.itemCrmUrl).toBe(
      'https://crm.example.com/crm/type/1146/details/9001/',
    )
    expect(JSON.stringify(body)).not.toContain('s3cr3t-token')
  })

  it('sem webhook configurado o link é null', () => {
    expect(crmOriginFromWebhook('')).toBeNull()
    expect(crmOriginFromWebhook('não é url')).toBeNull()
  })
})

describe('StartSubscriptionExpirationRunController', () => {
  const make = (
    result: Awaited<ReturnType<StartManualSubscriptionExpiration['execute']>>,
  ) => {
    const execute = vi.fn().mockResolvedValue(result)
    return {
      controller: new StartSubscriptionExpirationRunController({
        execute,
      } as unknown as StartManualSubscriptionExpiration),
      execute,
    }
  }

  it('responde 202 com o id da rodada e repassa o usuário', async () => {
    const { controller, execute } = make({ status: 'started', runId: 'run-9' })

    const response = await controller.perform(
      { portalUserId: 'user-1' } as never,
      {} as never,
    )

    expect(execute).toHaveBeenCalledWith('user-1')
    expect(response).toEqual({ status: 202, result: { runId: 'run-9' } })
  })

  it.each(['busy', 'disabled'] as const)(
    'responde 409 com code %s',
    async status => {
      const { controller } = make({ status })

      const response = await controller.perform(
        { portalUserId: 'user-1' } as never,
        {} as never,
      )

      expect(response.status).toBe(409)
      expect(response.result).toMatchObject({ code: status })
    },
  )
})

describe('rotas de subscription-expiration sem sessão do portal', () => {
  it.each([
    ['GET', '/api/portal/subscription-expiration/runs'],
    ['GET', '/api/portal/subscription-expiration/runs/run-1'],
    ['POST', '/api/portal/subscription-expiration/runs'],
    // "Falhas de envio": mesmas regras de sessão do portal admin.
    ['GET', '/api/portal/thinkzap/outbox-failures'],
    ['GET', '/api/portal/thinkzap/outbox-failures/outbox-1'],
    ['POST', '/api/portal/thinkzap/outbox-failures/outbox-1/reprocess'],
    ['POST', '/api/portal/thinkzap/outbox-failures/reprocess'],
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
