import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveLineBySubscriptionItem } from './resolve-line-by-subscription-item'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const zapiItem = (id: string, instanceId = 'Z-1'): SubscriptionItem => ({
  id,
  name: `Linha ${id}`,
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: instanceId,
    zApiInstanceToken: 'TOKEN-SECRETO',
  },
})

const hubItem = (id: string): SubscriptionItem => ({
  id,
  name: `Linha ${id}`,
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'HUBMESSAGE',
    hubmessageChannelId: 'C-9',
    wabaId: 'W-9',
  },
})

const noneItem = (id: string): SubscriptionItem => ({
  id,
  name: `Linha ${id}`,
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: { provider: 'NONE' },
})

const input = {
  subscriptionItemId: 'i1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
}

function makeSut(items: SubscriptionItem[][] = [[zapiItem('i1')]]) {
  const execute = vi.fn().mockResolvedValue({
    customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
    aplication: { id: 'installed-1', spaId: '42' },
    subscriptions: items.map((list, index) => ({
      id: `sub-${index + 1}`,
      items: list,
    })),
  })
  return {
    execute,
    resolve: (overrides: Partial<typeof input> = {}) =>
      resolveLineBySubscriptionItem({ ...input, ...overrides }, {
        execute,
      } as never),
  }
}

describe('resolveLineBySubscriptionItem', () => {
  let sut: ReturnType<typeof makeSut>

  beforeEach(() => {
    vi.clearAllMocks()
    sut = makeSut()
  })

  it('resolve a credencial Z-API a partir do metadata do item', async () => {
    const resolved = await sut.resolve()

    expect(resolved.zApiInstanceId).toBe('Z-1')
    expect(resolved.zApiInstanceToken).toBe('TOKEN-SECRETO')
    expect(resolved.item.id).toBe('i1')
  })

  it('resolve a instalação pelo par (domainId, appCode) do token', async () => {
    await sut.resolve()

    expect(sut.execute).toHaveBeenCalledWith({
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
    })
  })

  it('acha o item em qualquer assinatura da instalação', async () => {
    sut = makeSut([[zapiItem('outro')], [zapiItem('i1', 'Z-9')]])

    const resolved = await sut.resolve()

    expect(resolved.zApiInstanceId).toBe('Z-9')
  })

  /**
   * A resolução não toca no banco. Antes lia `Instance` em toda chamada, e três
   * dos quatro consumidores descartavam o resultado — quem precisa da âncora
   * persistida busca por conta própria.
   */
  it('resolve sem nenhuma leitura persistida', async () => {
    const resolved = await sut.resolve()

    expect(Object.keys(resolved).sort()).toEqual([
      'item',
      'zApiInstanceId',
      'zApiInstanceToken',
    ])
    expect(sut.execute).toHaveBeenCalledTimes(1)
  })

  describe('item fora do escopo do token', () => {
    it('lança LineNotFoundError para item que não está na árvore da instalação', async () => {
      await expect(
        sut.resolve({ subscriptionItemId: 'de-outro' }),
      ).rejects.toBeInstanceOf(LineNotFoundError)
    })

    it('lança LineNotFoundError quando a instalação não tem assinatura', async () => {
      sut = makeSut([])

      await expect(sut.resolve()).rejects.toBeInstanceOf(LineNotFoundError)
    })
  })

  describe('provider incompatível', () => {
    it('rejeita item HUBMESSAGE', async () => {
      sut = makeSut([[hubItem('i1')]])

      await expect(sut.resolve()).rejects.toBeInstanceOf(
        LineProviderNotSupportedError,
      )
    })

    it('rejeita item sem provider', async () => {
      sut = makeSut([[noneItem('i1')]])

      await expect(sut.resolve()).rejects.toBeInstanceOf(
        LineProviderNotSupportedError,
      )
    })
  })

  it('propaga falha de leitura do contexto em vez de virar não encontrado', async () => {
    sut.execute.mockRejectedValue(new Error('Bitrix indisponível'))

    await expect(sut.resolve()).rejects.toThrow('Bitrix indisponível')
    await expect(sut.resolve()).rejects.not.toBeInstanceOf(LineNotFoundError)
  })

  it('não recebe repositório nenhum — nada de banco no caminho', () => {
    // Só o input e o contexto da aplicação: não há como o helper consultar
    // `core_thinkerszap_connectors` nem `core_thinkerszap_instances`. Este teste
    // trava a assinatura contra a volta de qualquer leitura persistida.
    expect(resolveLineBySubscriptionItem.length).toBe(2)
  })
})
