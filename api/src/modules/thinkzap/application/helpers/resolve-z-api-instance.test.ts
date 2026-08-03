import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { describe, expect, it, vi } from 'vitest'
import { resolveZApiInstance } from './resolve-z-api-instance'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const zapiItem = (id: string): SubscriptionItem => ({
  id,
  name: `Linha ${id}`,
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
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

const input = {
  subscriptionItemId: 'i1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
}

function makeSut(
  options: {
    items?: SubscriptionItem[]
    connected?: boolean
    phoneData?: unknown
    phoneThrows?: boolean
  } = {},
) {
  const {
    items = [zapiItem('i1')],
    connected = true,
    phoneData = { phone: '5511999999999' },
    phoneThrows = false,
  } = options

  const execute = vi.fn().mockResolvedValue({
    customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
    aplication: { id: 'installed-1', spaId: '42' },
    subscriptions: [{ id: 'sub-1', items }],
  })

  const getInstance = vi.fn().mockResolvedValue({ connected })
  const getPhoneData = phoneThrows
    ? vi.fn().mockRejectedValue(new Error('Failed to get phone data'))
    : vi.fn().mockResolvedValue(phoneData)

  return {
    execute,
    getInstance,
    getPhoneData,
    resolve: (overrides: Partial<typeof input> = {}) =>
      resolveZApiInstance(
        { ...input, ...overrides },
        { execute } as never,
        {
          getInstance,
          getPhoneData,
        } as never,
      ),
  }
}

describe('resolveZApiInstance', () => {
  it('resolve a credencial do item e o telefone quando a linha está conectada', async () => {
    const sut = makeSut()

    await expect(sut.resolve()).resolves.toEqual({
      instanceId: 'Z-1',
      zApiToken: 'TOKEN-SECRETO',
      instancePhone: '5511999999999',
    })
    expect(sut.getInstance).toHaveBeenCalledWith('Z-1', 'TOKEN-SECRETO')
  })

  /**
   * A regressão que motivou a mudança: linha conectada de fato, sem registro em
   * `Instance`, recusava grupos com "Instance not found" enquanto a aba Conexão
   * mostrava os dados do aparelho.
   */
  it('não lê nada persistido — só contexto e Z-API', async () => {
    const sut = makeSut()

    await sut.resolve()

    expect(sut.execute).toHaveBeenCalledWith({
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
    })
  })

  it('recusa quando a Z-API diz que a linha não está conectada', async () => {
    const sut = makeSut({ connected: false })

    await expect(sut.resolve()).rejects.toThrow('Instance is not connected')
    expect(sut.getPhoneData).not.toHaveBeenCalled()
  })

  it('degrada o telefone para null quando getPhoneData falha', async () => {
    const sut = makeSut({ phoneThrows: true })

    await expect(sut.resolve()).resolves.toMatchObject({ instancePhone: null })
  })

  it('degrada o telefone para null quando a resposta não traz phone', async () => {
    const sut = makeSut({ phoneData: null })

    await expect(sut.resolve()).resolves.toMatchObject({ instancePhone: null })
  })

  it('rejeita item de outra instalação com LineNotFoundError', async () => {
    const sut = makeSut({ items: [zapiItem('outro')] })

    await expect(sut.resolve()).rejects.toBeInstanceOf(LineNotFoundError)
    expect(sut.getInstance).not.toHaveBeenCalled()
  })

  it('rejeita linha de provider não-Z-API', async () => {
    const sut = makeSut({ items: [hubItem('i1')] })

    await expect(sut.resolve()).rejects.toBeInstanceOf(
      LineProviderNotSupportedError,
    )
    expect(sut.getInstance).not.toHaveBeenCalled()
  })

  it('propaga falha de leitura do contexto em vez de virar não encontrada', async () => {
    const sut = makeSut()
    sut.execute.mockRejectedValue(new Error('Bitrix indisponível'))

    await expect(sut.resolve()).rejects.toThrow('Bitrix indisponível')
  })
})
