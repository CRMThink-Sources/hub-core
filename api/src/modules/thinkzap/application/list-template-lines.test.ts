import { describe, expect, it, vi } from 'vitest'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { ListTemplateLinesUseCase } from './list-template-lines'

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

type Sub = {
  id: string
  status: string
  currentPeriodEnd: Date
  items: SubscriptionItem[]
}

function activeSub(items: SubscriptionItem[]): Sub {
  return {
    id: 'sub_1',
    status: 'active',
    currentPeriodEnd: new Date('2099-01-01'),
    items,
  }
}

function build(subscriptions: Sub[]) {
  const execute = vi.fn().mockResolvedValue({
    customer: { id: 'domain_1' },
    aplication: { id: 'app_1', spaId: '42' },
    subscriptions,
  })

  return {
    execute,
    useCase: new ListTemplateLinesUseCase({
      execute,
    } as unknown as GetAplicationContext),
  }
}

describe('ListTemplateLinesUseCase', () => {
  it('devolve id e nome das linhas oficiais com canal conectado', async () => {
    const { useCase } = build([activeSub([hubItem])])

    expect(await useCase.execute(input)).toEqual([
      { id: 'item_1', name: 'Linha oficial' },
    ])
  })

  // Template não existe na Z-API: oferecê-la entregaria uma automação que só falha
  // no primeiro disparo, longe da tela onde o motivo seria explicado.
  it('não oferece linha Z-API', async () => {
    const { useCase } = build([activeSub([zapiItem, hubItem])])

    expect(await useCase.execute(input)).toEqual([
      { id: 'item_1', name: 'Linha oficial' },
    ])
  })

  it('não oferece linha oficial sem canal conectado', async () => {
    const { useCase } = build([activeSub([hubItemWithoutWaba])])

    expect(await useCase.execute(input)).toEqual([])
  })

  it('não oferece linha de assinatura cancelada', async () => {
    const { useCase } = build([
      {
        id: 'sub_1',
        status: 'cancelled',
        currentPeriodEnd: new Date('2099-01-01'),
        items: [hubItem],
      },
    ])

    expect(await useCase.execute(input)).toEqual([])
  })

  it('não oferece linha de trial vencido', async () => {
    const { useCase } = build([
      {
        id: 'sub_1',
        status: 'trialing',
        currentPeriodEnd: new Date('2000-01-01'),
        items: [hubItem],
      },
    ])

    expect(await useCase.execute(input)).toEqual([])
  })

  // O escopo sai do JWT: o caso de uso só enxerga as assinaturas da instalação que o
  // contexto devolve, então linha de outra instalação não é alcançável por id.
  it('lê apenas o contexto da instalação do token', async () => {
    const { useCase, execute } = build([activeSub([hubItem])])

    await useCase.execute(input)

    expect(execute).toHaveBeenCalledWith({
      domainId: 'domain_1',
      appCode: 'crmthink.thinkzap',
    })
  })
})
