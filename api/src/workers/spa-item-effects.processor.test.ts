import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Os processors importam a fila (por `isDisabledSpaEffect`), e o módulo da fila abre
 * conexão com o Redis na importação. O teste é sobre a guarda de ambiente, então
 * conexão, fila e casos de uso são dublados.
 */
vi.mock('@/queue/redis-connection', () => ({
  bullBaseOptions: { connection: {}, prefix: 'bull' },
}))
vi.mock('bullmq', () => ({ Queue: class {} }))

const { provision, cleanup, statusSync, subscriptionSync, logInfo } =
  vi.hoisted(() => ({
    provision: vi.fn(() =>
      Promise.resolve({ outcome: 'provisioned', billingAdjusted: false }),
    ),
    cleanup: vi.fn(() =>
      Promise.resolve({ outcome: 'cleaned', billingAdjusted: false }),
    ),
    statusSync: vi.fn(() => Promise.resolve({ outcome: 'noop' })),
    subscriptionSync: vi.fn(() =>
      Promise.resolve({ items: 0, subscribed: 0, failed: 0 }),
    ),
    logInfo: vi.fn(),
  }))

vi.mock('@/shared/infra/logger', () => ({
  workerLogger: {
    child: () => ({
      info: logInfo,
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
  apiLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/modules/thinkzap/main/make-provision-line-from-spa-item', () => ({
  makeProvisionLineFromSpaItem: () => ({ execute: provision }),
}))
vi.mock('@/modules/thinkzap/main/make-cleanup-deleted-spa-item-line', () => ({
  makeCleanupDeletedSpaItemLine: () => ({ execute: cleanup }),
}))
vi.mock('@/modules/thinkzap/main/make-sync-spa-item-resource-status', () => ({
  makeSyncSpaItemResourceStatus: () => ({ execute: statusSync }),
}))
vi.mock('@/modules/thinkzap/main/make-sync-subscription-lines-billing', () => ({
  makeSyncSubscriptionLinesBilling: () => ({ execute: subscriptionSync }),
}))

import { processSpaItemProvisioning } from './spa-item-provisioning.processor'
import {
  processSpaItemCleanup,
  processSpaItemStatusSync,
  processSubscriptionBillingSync,
} from './spa-item-resource-sync.processor'

const webhookJob = {
  itemId: '77',
  traceKey: 'spa-item-77',
  source: 'spa-webhook' as const,
}

describe('guarda de efeitos de provider nos processors da SPA', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('efeitos desligados (homologação)', () => {
    it('descarta o provisionamento vindo do webhook', async () => {
      await processSpaItemProvisioning(webhookJob, false)

      expect(provision).not.toHaveBeenCalled()
      expect(logInfo).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'disabled' }),
        expect.any(String),
      )
    })

    it('descarta limpeza e sincronização de status vindas do webhook', async () => {
      await processSpaItemCleanup(webhookJob, false)
      await processSpaItemStatusSync(webhookJob, false)

      expect(cleanup).not.toHaveBeenCalled()
      expect(statusSync).not.toHaveBeenCalled()
    })

    it('descarta a cobrança por assinatura vinda do webhook', async () => {
      await processSubscriptionBillingSync(
        {
          subscriptionId: '501',
          traceKey: 'spa-subscription-501',
          source: 'spa-webhook',
        },
        false,
      )

      expect(subscriptionSync).not.toHaveBeenCalled()
    })

    /**
     * Sem `source` é job enfileirado antes do campo existir — e antes dele só o webhook
     * enfileirava. É exatamente o que a defesa no worker existe para pegar.
     */
    it('trata job sem source como vindo do webhook', async () => {
      await processSpaItemStatusSync(
        { itemId: '77', traceKey: 'spa-item-77' },
        false,
      )

      expect(statusSync).not.toHaveBeenCalled()
    })

    it('processa a limpeza pedida pelo próprio app (DeleteLine)', async () => {
      await processSpaItemCleanup(
        {
          itemId: '77',
          traceKey: 'uuid',
          deletedBy: 'Fulano',
          deletedAt: '2026-10-13T00:00:00.000Z',
          source: 'app',
        },
        false,
      )

      expect(cleanup).toHaveBeenCalledWith({
        itemId: '77',
        traceKey: 'uuid',
        deletedBy: 'Fulano',
        deletedAt: '2026-10-13T00:00:00.000Z',
      })
    })
  })

  describe('efeitos ligados (produção)', () => {
    it('processa todos os jobs do webhook', async () => {
      await processSpaItemProvisioning(webhookJob, true)
      await processSpaItemCleanup(webhookJob, true)
      await processSpaItemStatusSync(webhookJob, true)
      await processSubscriptionBillingSync(
        {
          subscriptionId: '501',
          traceKey: 'spa-subscription-501',
          source: 'spa-webhook',
        },
        true,
      )

      expect(provision).toHaveBeenCalledTimes(1)
      expect(cleanup).toHaveBeenCalledTimes(1)
      expect(statusSync).toHaveBeenCalledTimes(1)
      expect(subscriptionSync).toHaveBeenCalledWith({
        subscriptionId: '501',
        traceKey: 'spa-subscription-501',
      })
    })
  })
})
