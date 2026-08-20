import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureLineInstance } from './ensure-line-instance'
import { InstanceStatus } from '@/modules/thinkzap/domain/entities/instance'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const zapiItem = (
  vinculatedChannel: string | null = null,
): SubscriptionItem => ({
  id: 'i1',
  name: 'Linha i1',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'TOKEN-SECRETO',
  },
})

const hubItem = (): SubscriptionItem => ({
  ...zapiItem(),
  metadata: {
    provider: 'HUBMESSAGE',
    hubmessageChannelId: 'C-9',
    wabaId: 'W-9',
  },
})

const noneItem = (): SubscriptionItem => ({
  ...zapiItem(),
  metadata: { provider: 'NONE' },
})

const existingRow = { id: 'uuid-1', instanceId: 'Z-1' }

function makeSut(existing: unknown = null) {
  const getInstanceByInstanceId = vi.fn().mockResolvedValue(existing)
  const getInstanceByChannelId = vi.fn().mockResolvedValue(null)
  const create = vi.fn().mockResolvedValue({ id: 'uuid-novo' })

  return {
    getInstanceByInstanceId,
    getInstanceByChannelId,
    create,
    ensure: (item: SubscriptionItem) =>
      ensureLineInstance(item, 'domain-1', {
        getInstanceByInstanceId,
        getInstanceByChannelId,
        create,
      } as never),
  }
}

describe('ensureLineInstance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('devolve a row existente sem criar nada', async () => {
    const sut = makeSut(existingRow)

    await expect(sut.ensure(zapiItem())).resolves.toEqual(existingRow)
    expect(sut.create).not.toHaveBeenCalled()
  })

  /** O buraco de origem: linha criada na SPA não tinha registro e não persistia mensagem. */
  it('cria a âncora quando não existe', async () => {
    const sut = makeSut(null)

    await expect(sut.ensure(zapiItem())).resolves.toEqual({ id: 'uuid-novo' })
    expect(sut.create).toHaveBeenCalledWith(
      expect.objectContaining({
        domainId: 'domain-1',
        instanceId: 'Z-1',
        zApiToken: 'TOKEN-SECRETO',
        status: InstanceStatus.CONNECTED,
      }),
    )
  })

  /**
   * O roteamento de entrada encontra a instância **pelo** canal. Nascer sem o
   * vínculo que o item já declara deixaria a linha sem receber, mesmo com row.
   */
  it('nasce com o vínculo que o item declara', async () => {
    const sut = makeSut(null)

    await sut.ensure(zapiItem('10'))

    expect(sut.create).toHaveBeenCalledWith(
      expect.objectContaining({ vinculatedChannel: '10' }),
    )
  })

  /**
   * A coluna `settings` está deprecada e o `@default("{}")` cobre o `NOT NULL`.
   * Mandar valor aqui reintroduziria a escrita que `move-connector-settings-to-spa`
   * tirou — e a row voltaria a carregar um valor que ninguém lê mas que alguém
   * pode voltar a ler.
   */
  it('não grava settings na âncora — a fonte é o item da SPA', async () => {
    const sut = makeSut(null)

    await sut.ensure(zapiItem())
    await sut.ensure(hubItem())

    for (const call of sut.create.mock.calls) {
      expect(call[0] as Record<string, unknown>).not.toHaveProperty('settings')
    }
  })

  it('não manda campos de HubMessage — as colunas podem não existir', async () => {
    const sut = makeSut(null)

    await sut.ensure(zapiItem())

    const input = sut.create.mock.calls[0]?.[0] as Record<string, unknown>
    expect(input).not.toHaveProperty('channelId')
    expect(input).not.toHaveProperty('webhookId')
    expect(input).not.toHaveProperty('wabaId')
    expect(input).not.toHaveProperty('phoneId')
  })

  /**
   * HubMessage tem caminho próprio: chaveado por `channelId`, que é o que o webhook
   * daquele provider entrega. `wabaId` vem do item; `phoneId` fica nulo até a
   * conexão acontecer.
   */
  it('cria a âncora de HubMessage pelo canal, com wabaId do item', async () => {
    const sut = makeSut(null)

    await sut.ensure(hubItem())

    expect(sut.getInstanceByChannelId).toHaveBeenCalledWith('C-9')
    const input = sut.create.mock.calls[0]?.[0] as Record<string, unknown>
    expect(input).toMatchObject({
      instanceId: 'C-9',
      channelId: 'C-9',
      wabaId: 'W-9',
      zApiToken: null,
    })
    expect(input).not.toHaveProperty('phoneId')
  })

  it('devolve a âncora HubMessage existente sem criar', async () => {
    const sut = makeSut(null)
    sut.getInstanceByChannelId.mockResolvedValue({ id: 'uuid-hub' })

    await expect(sut.ensure(hubItem())).resolves.toEqual({ id: 'uuid-hub' })
    expect(sut.create).not.toHaveBeenCalled()
  })

  it('rejeita linha sem provider antes de tocar o banco', async () => {
    const sut = makeSut(null)

    await expect(sut.ensure(noneItem())).rejects.toBeInstanceOf(
      LineProviderNotSupportedError,
    )
    expect(sut.getInstanceByInstanceId).not.toHaveBeenCalled()
  })

  /** Duas requisições simultâneas: `instanceId` é `@unique`, a segunda leitura resolve. */
  it('resolve corrida relendo em vez de duplicar', async () => {
    const sut = makeSut(null)
    sut.create.mockRejectedValue(new Error('Unique constraint failed'))
    sut.getInstanceByInstanceId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingRow)

    await expect(sut.ensure(zapiItem())).resolves.toEqual(existingRow)
  })

  it('relança quando a falha de criação não era corrida', async () => {
    const sut = makeSut(null)
    sut.create.mockRejectedValue(new Error('ColumnNotFound'))

    await expect(sut.ensure(zapiItem())).rejects.toThrow('ColumnNotFound')
  })
})
