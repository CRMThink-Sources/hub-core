import { describe, expect, it, vi } from 'vitest'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ListButtonLinesUseCase } from './list-button-lines'

const hubItem: SubscriptionItem = {
  id: 'item_1',
  name: 'Linha oficial',
  subscription: 'sub_1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'HUBMESSAGE',
    hubmessageChannelId: 'chan_1',
    wabaId: 'waba_1',
  },
}

const hubItemWithoutWaba: SubscriptionItem = {
  ...hubItem,
  id: 'item_sem_waba',
  name: 'Oficial em conexão',
  metadata: { provider: 'HUBMESSAGE', hubmessageChannelId: 'chan_2' },
}

const zapiItem: SubscriptionItem = {
  ...hubItem,
  id: 'item_zapi',
  name: 'Linha Z-API',
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'tk',
  },
}

const input = { domainId: 'domain_1', appCode: 'crmthink.thinkzap' }

function activeSub(items: SubscriptionItem[]) {
  return {
    id: 'sub_1',
    status: 'active',
    currentPeriodEnd: new Date('2099-01-01'),
    items,
  }
}

function build(
  provider: ConnectorProvider,
  subscriptions: ReturnType<typeof activeSub>[],
) {
  const execute = vi.fn().mockResolvedValue({
    customer: { id: 'domain_1' },
    aplication: { id: 'app_1', spaId: '42' },
    subscriptions,
  })

  return {
    execute,
    useCase: new ListButtonLinesUseCase(
      { execute } as unknown as GetAplicationContext,
      provider,
    ),
  }
}

describe('ListButtonLinesUseCase — HUBMESSAGE', () => {
  it('devolve id e nome das linhas oficiais com canal conectado', async () => {
    const { useCase } = build(ConnectorProvider.HUBMESSAGE, [
      activeSub([hubItem]),
    ])

    expect(await useCase.execute(input)).toEqual([
      { id: 'item_1', name: 'Linha oficial' },
    ])
  })

  it('não oferece linha Z-API', async () => {
    const { useCase } = build(ConnectorProvider.HUBMESSAGE, [
      activeSub([zapiItem, hubItem]),
    ])

    expect(await useCase.execute(input)).toEqual([
      { id: 'item_1', name: 'Linha oficial' },
    ])
  })

  it('não oferece linha oficial sem canal conectado', async () => {
    const { useCase } = build(ConnectorProvider.HUBMESSAGE, [
      activeSub([hubItemWithoutWaba]),
    ])

    expect(await useCase.execute(input)).toEqual([])
  })
})

describe('ListButtonLinesUseCase — ZAPI', () => {
  it('devolve id e nome das linhas Z-API, sem exigir canal conectado', async () => {
    const { useCase } = build(ConnectorProvider.ZAPI, [
      activeSub([zapiItem, hubItem]),
    ])

    expect(await useCase.execute(input)).toEqual([
      { id: 'item_zapi', name: 'Linha Z-API' },
    ])
  })
})

describe('ListButtonLinesUseCase — habilitação', () => {
  it('não oferece linha de assinatura cancelada', async () => {
    const { useCase } = build(ConnectorProvider.HUBMESSAGE, [
      {
        id: 'sub_1',
        status: 'cancelled',
        currentPeriodEnd: new Date('2099-01-01'),
        items: [hubItem],
      },
    ])

    expect(await useCase.execute(input)).toEqual([])
  })

  it('lê apenas o contexto da instalação do token', async () => {
    const { useCase, execute } = build(ConnectorProvider.HUBMESSAGE, [
      activeSub([hubItem]),
    ])

    await useCase.execute(input)

    expect(execute).toHaveBeenCalledWith({
      domainId: 'domain_1',
      appCode: 'crmthink.thinkzap',
    })
  })
})
