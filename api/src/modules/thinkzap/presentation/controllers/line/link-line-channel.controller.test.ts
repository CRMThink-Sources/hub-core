import { describe, expect, it, vi } from 'vitest'
import { LinkLineChannelController } from './link-line-channel.controller'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { Request } from 'express'

/**
 * `env` não é mockado: um mock parcial derruba a construção do logger, que lê
 * `logLevel` no import. O código do conector do Bitrix não é o assunto destes testes.
 */
vi.mock('@/modules/thinkzap/application/helpers/ensure-line-instance', () => ({
  ensureLineInstance: vi.fn().mockResolvedValue({ id: 'inst-1' }),
}))

const item = (
  id: string,
  vinculatedChannel: string | null,
  status: SubscriptionItem['status'] = 'active',
): SubscriptionItem => ({
  id,
  name: `Linha ${id}`,
  subscription: 'sub-1',
  status,
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: `INST-${id}`,
    zApiInstanceToken: 'TOKEN',
  },
})

/** Assinatura ativa e com folga: o guard de entitlement não é o assunto aqui. */
const subscription = (items: SubscriptionItem[]) => ({
  id: 'sub-1',
  status: 'active',
  currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
  items,
})

function makeSut(items: SubscriptionItem[]) {
  const activateConnector = vi.fn().mockResolvedValue(undefined)
  const updateSubscriptionItem = vi.fn().mockResolvedValue(undefined)

  const controller = new LinkLineChannelController(
    {
      execute: vi.fn().mockResolvedValue({
        customer: { id: 'domain-1' },
        aplication: { id: 'app-1', spaId: '42' },
        subscriptions: [subscription(items)],
      }),
    } as never,
    { updateSubscriptionItem } as never,
    {} as never,
    { activateConnector } as never,
  )

  return { controller, activateConnector, updateSubscriptionItem }
}

const request = (itemId: string, lineId: number): Request =>
  ({
    params: { itemId },
    domainId: 'domain-1',
    appId: 'crmthink.thinkzap',
    body: { lineId },
  }) as never

describe('LinkLineChannelController', () => {
  it('vincula o canal livre', async () => {
    const sut = makeSut([item('i1', null)])

    const response = await sut.controller.perform(request('i1', 136))

    expect(response.status).toBe(200)
    expect(sut.updateSubscriptionItem).toHaveBeenCalledWith('i1', {
      vinculatedChannel: '136',
    })
  })

  /**
   * A causa raiz do "mensagem sai pelo número errado": duas linhas no mesmo canal, e a
   * saída do Bitrix só carrega o canal. Recusar na escrita é o que impede o estado.
   */
  it('recusa canal já ocupado por outra linha ativa, sem tocar o Bitrix', async () => {
    const sut = makeSut([item('i1', null), item('i2', '136')])

    const response = await sut.controller.perform(request('i1', 136))

    expect(response.status).toBe(409)
    expect(String((response.result as { error: string }).error)).toContain(
      'Linha i2',
    )
    expect(sut.activateConnector).not.toHaveBeenCalled()
    expect(sut.updateSubscriptionItem).not.toHaveBeenCalled()
  })

  it('permite revincular a linha ao canal que ela já tem', async () => {
    const sut = makeSut([item('i1', '136')])

    const response = await sut.controller.perform(request('i1', 136))

    expect(response.status).toBe(200)
  })

  /** Linha cancelada não responde por canal nenhum, então não o ocupa. */
  it('ignora item cancelado ao conferir o canal', async () => {
    const sut = makeSut([item('i1', null), item('i2', '136', 'cancelled')])

    const response = await sut.controller.perform(request('i1', 136))

    expect(response.status).toBe(200)
    expect(sut.activateConnector).toHaveBeenCalledWith(136, expect.any(String))
  })
})
