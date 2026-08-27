import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// `Controller` arrasta o logger, que lê `logLevel`/`nodeEnv` do mesmo módulo.
vi.mock('@/config/env', () => ({
  env: {
    logLevel: 'silent',
    nodeEnv: 'test',
    lokiUrl: '',
    bitrix: { connector: { code: 'thinkzap' } },
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

function makeController(ctx: unknown = context) {
  const execute = vi.fn().mockResolvedValue(ctx)
  const deleteSubscriptionItem = vi.fn().mockResolvedValue(undefined)

  const controller = new DeleteLineController(
    new DeleteLine(
      { execute } as never,
      {
        deleteSubscriptionItem,
      } as never,
    ),
  )

  return { controller, execute, deleteSubscriptionItem }
}

describe('DeleteLineController', () => {
  beforeEach(() => vi.clearAllMocks())

  it('apaga o item da instalação', async () => {
    const { controller, deleteSubscriptionItem } = makeController()

    const response = await controller.perform(req('i1'))

    expect(deleteSubscriptionItem).toHaveBeenCalledWith('i1')
    expect(response.status).toBe(200)
  })

  /**
   * Indistinguível de inexistente de propósito: confirmar a existência de recurso
   * alheio já é vazamento.
   */
  it('item de outra instalação responde 404 e não apaga', async () => {
    const { controller, deleteSubscriptionItem } = makeController()

    const response = await controller.perform(req('de-outro-cliente'))

    expect(response.status).toBe(404)
    expect(deleteSubscriptionItem).not.toHaveBeenCalled()
  })

  it('item inexistente responde 404, não erro de servidor', async () => {
    const { controller } = makeController()

    const response = await controller.perform(req('nao-existe'))

    expect(response.status).toBe(404)
  })

  /**
   * A rota apaga o item e para. Desassinar no provider e ajustar a cobrança são do
   * webhook de saída da SPA — uma segunda implementação aqui divergiria dele.
   */
  it('não toca provider nem gateway', async () => {
    const { controller } = makeController()

    // O caso de uso recebe **só** contexto e repositório de itens: não há como
    // alcançar provider ou gateway daqui. O teste fixa isso na assinatura.
    expect(DeleteLine.length).toBe(2)

    await controller.perform(req('i1'))
  })

  /**
   * Contrato cancelado e período vencido: a linha está bloqueada. Recusar a exclusão
   * prenderia o cliente a uma linha que ele não usa mais — `assertLineEnabled` guarda
   * escrita **na** linha, e apagar não é escrever nela.
   */
  it('linha bloqueada ainda pode ser excluída', async () => {
    const { controller, deleteSubscriptionItem } =
      makeController(blockedContext)

    const response = await controller.perform(req('i1'))

    expect(response.status).toBe(200)
    expect(deleteSubscriptionItem).toHaveBeenCalledWith('i1')
  })
})
