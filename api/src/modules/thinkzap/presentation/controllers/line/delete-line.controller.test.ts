import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// `Controller` arrasta o logger, que lê `logLevel`/`nodeEnv` do mesmo módulo.
vi.mock('@/config/env', () => ({
  env: {
    logLevel: 'silent',
    nodeEnv: 'test',
    lokiUrl: '',
    bitrix: { connector: { code: 'thinkzap' } },
    crmthinkWebhookUrl: 'https://crmthink.bitrix24.com.br/rest/1/token',
    payments: { spa: { subscriptionItemEntityType: 1146 } },
  },
}))

import { Request } from 'express'
import { DeleteLineController } from './delete-line.controller'
import { DeleteLine } from '@/modules/thinkzap/application/delete-line'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const item: SubscriptionItem = {
  id: 'i1',
  name: 'Linha comercial',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'TOKEN-SECRETO',
  },
}

const context = {
  customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
  aplication: { id: 'installed-1', spaId: '42' },
  subscriptions: [{ id: 'sub-1', status: 'active', items: [item] }],
}

const req = (itemId: string) =>
  ({
    params: { itemId },
    body: {},
    domainId: 'domain-1',
    appId: 'crmthink.thinkzap',
    bitrixUserId: 'bx-user-1',
  }) as unknown as Request

/** Instalação cujo contrato acabou: a linha existe e está bloqueada. */
const blockedContext = {
  ...context,
  subscriptions: [
    {
      id: 'sub-1',
      status: 'cancelled',
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
      items: [item],
    },
  ],
}

function makeController({
  ctx = context,
  displayName = { name: 'Ana Souza' },
  allowedUserDisplayName,
}: {
  ctx?: unknown
  displayName?: { name: string | null; refusal?: string }
  allowedUserDisplayName?: string | null
} = {}) {
  const execute = vi.fn().mockResolvedValue(ctx)
  const updateSubscriptionItem = vi.fn().mockResolvedValue(item)
  const getDisplayName = vi.fn().mockResolvedValue(displayName)
  const getByAppIdAndBitrixUserId = vi
    .fn()
    .mockResolvedValue(
      allowedUserDisplayName !== undefined
        ? { displayName: allowedUserDisplayName }
        : null,
    )
  const ensureDeletionFieldsExist = vi.fn().mockResolvedValue(undefined)
  const enqueueCleanup = vi.fn().mockResolvedValue({ id: 'job-1' })

  const controller = new DeleteLineController(
    new DeleteLine(
      { execute } as never,
      { updateSubscriptionItem } as never,
      { getDisplayName } as never,
      { getByAppIdAndBitrixUserId } as never,
      ensureDeletionFieldsExist,
      enqueueCleanup,
    ),
  )

  return {
    controller,
    execute,
    updateSubscriptionItem,
    getDisplayName,
    getByAppIdAndBitrixUserId,
    ensureDeletionFieldsExist,
    enqueueCleanup,
  }
}

describe('DeleteLineController', () => {
  beforeEach(() => vi.clearAllMocks())

  it('edita o item para cancelado, com deletedAt/deletedBy, e enfileira a limpeza', async () => {
    const { controller, updateSubscriptionItem, enqueueCleanup } =
      makeController()

    const response = await controller.perform(req('i1'))

    expect(response.status).toBe(200)
    expect(updateSubscriptionItem).toHaveBeenCalledWith('i1', {
      status: 'cancelled',
      deletedAt: expect.any(Date) as Date,
      deletedBy: 'Ana Souza',
    })
    expect(enqueueCleanup).toHaveBeenCalledWith({
      itemId: 'i1',
      traceKey: expect.any(String) as string,
      deletedBy: 'Ana Souza',
      deletedAt: expect.any(String) as string,
    })
  })

  it('confere os campos de auditoria na SPA antes de escrever', async () => {
    const { controller, ensureDeletionFieldsExist, updateSubscriptionItem } =
      makeController()

    await controller.perform(req('i1'))

    expect(ensureDeletionFieldsExist).toHaveBeenCalled()
    expect(ensureDeletionFieldsExist.mock.invocationCallOrder[0]!).toBeLessThan(
      updateSubscriptionItem.mock.invocationCallOrder[0]!,
    )
  })

  /**
   * Indistinguível de inexistente de propósito: confirmar a existência de recurso
   * alheio já é vazamento.
   */
  it('item de outra instalação responde 404 e não edita', async () => {
    const { controller, updateSubscriptionItem } = makeController()

    const response = await controller.perform(req('de-outro-cliente'))

    expect(response.status).toBe(404)
    expect(updateSubscriptionItem).not.toHaveBeenCalled()
  })

  it('item inexistente responde 404, não erro de servidor', async () => {
    const { controller } = makeController()

    const response = await controller.perform(req('nao-existe'))

    expect(response.status).toBe(404)
  })

  /**
   * Contrato cancelado e período vencido: a linha está bloqueada. Recusar a exclusão
   * prenderia o cliente a uma linha que ele não usa mais — `assertLineEnabled` guarda
   * escrita **na** linha, e excluir não é escrever nela.
   */
  it('linha bloqueada ainda pode ser excluída', async () => {
    const { controller, updateSubscriptionItem } = makeController({
      ctx: blockedContext,
    })

    const response = await controller.perform(req('i1'))

    expect(response.status).toBe(200)
    expect(updateSubscriptionItem).toHaveBeenCalledWith(
      'i1',
      expect.objectContaining({ status: 'cancelled' }),
    )
  })

  it('cai no nome do AllowedUser quando o Bitrix do cliente não resolve', async () => {
    const { controller, updateSubscriptionItem } = makeController({
      displayName: { name: null, refusal: 'sem escopo user.get' },
      allowedUserDisplayName: 'Bruno Lima',
    })

    await controller.perform(req('i1'))

    expect(updateSubscriptionItem).toHaveBeenCalledWith(
      'i1',
      expect.objectContaining({ deletedBy: 'Bruno Lima' }),
    )
  })

  it('grava o bitrixUserId bruto quando as duas origens de nome falham', async () => {
    const { controller, updateSubscriptionItem } = makeController({
      displayName: { name: null },
      allowedUserDisplayName: null,
    })

    const response = await controller.perform(req('i1'))

    expect(response.status).toBe(200)
    expect(updateSubscriptionItem).toHaveBeenCalledWith(
      'i1',
      expect.objectContaining({ deletedBy: 'bx-user-1' }),
    )
  })
})
