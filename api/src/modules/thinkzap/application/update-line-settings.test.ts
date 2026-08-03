import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdateLineSettings } from './update-line-settings'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const item = (settings = DEFAULT_CONNECTOR_SETTINGS): SubscriptionItem => ({
  id: 'i1',
  name: 'Linha i1',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...settings },
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'TOKEN-SECRETO',
  },
})

function makeSut(current = DEFAULT_CONNECTOR_SETTINGS) {
  const rename = { execute: vi.fn().mockResolvedValue(undefined) }
  const binds = { execute: vi.fn().mockResolvedValue(undefined) }
  const updateSubscriptionItem = vi.fn().mockResolvedValue(item(current))

  const useCase = new UpdateLineSettings(
    rename as never,
    binds as never,
    { updateSubscriptionItem } as never,
  )

  return {
    rename,
    binds,
    updateSubscriptionItem,
    execute: (
      patch: Parameters<typeof useCase.execute>[0] extends never
        ? never
        : Partial<Parameters<typeof useCase.execute>[0]>,
    ) =>
      useCase.execute({
        item: item(current),
        zApiInstanceId: 'Z-1',
        zApiInstanceToken: 'TOKEN-SECRETO',
        domainName: 'acme.bitrix24.com.br',
        appId: 'installed-1',
        ...patch,
      } as Parameters<typeof useCase.execute>[0]),
  }
}

describe('UpdateLineSettings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('grava os quatro toggles numa escrita só, no item da SPA', async () => {
    const sut = makeSut()

    await sut.execute({ settings: { prefixOperatorNameEnabled: true } })

    expect(sut.updateSubscriptionItem).toHaveBeenCalledTimes(1)
    expect(sut.updateSubscriptionItem).toHaveBeenCalledWith('i1', {
      settings: {
        ...DEFAULT_CONNECTOR_SETTINGS,
        prefixOperatorNameEnabled: true,
      },
    })
  })

  it('faz merge sobre o valor atual do item em vez de gravar o patch', async () => {
    const current = {
      ...DEFAULT_CONNECTOR_SETTINGS,
      widgetOpenChannelEnabled: true,
    }
    const sut = makeSut(current)

    await sut.execute({ settings: { prefixOperatorNameEnabled: true } })

    expect(sut.updateSubscriptionItem).toHaveBeenCalledWith('i1', {
      settings: { ...current, prefixOperatorNameEnabled: true },
    })
  })

  it('renomeia no provider com o prefixo do host do portal', async () => {
    const sut = makeSut()

    await sut.execute({ name: 'Comercial' })

    expect(sut.rename.execute).toHaveBeenCalledWith({
      zApiInstanceId: 'Z-1',
      zApiInstanceToken: 'TOKEN-SECRETO',
      domainName: 'acme.bitrix24.com.br',
      name: 'Comercial',
    })
  })

  it('não grava no item quando só o nome muda', async () => {
    const sut = makeSut()

    await sut.execute({ name: 'Comercial' })

    expect(sut.updateSubscriptionItem).not.toHaveBeenCalled()
  })

  it('faz bind/unbind só para os toggles de evento', async () => {
    const sut = makeSut()

    await sut.execute({ settings: { prefixOperatorNameEnabled: true } })

    expect(sut.binds.execute).not.toHaveBeenCalled()
  })

  it('chama os binds quando um toggle de evento muda', async () => {
    const sut = makeSut()

    await sut.execute({ settings: { messageUpdateEventEnabled: false } })

    expect(sut.binds.execute).toHaveBeenCalledWith({
      appId: 'installed-1',
      messageUpdateEventEnabled: false,
      messageDeleteEventEnabled: undefined,
    })
  })

  /**
   * Com escrita única, falha de bind não deixa mais estado meio salvo — antes os
   * toggles simples já estavam gravados quando o bind estourava.
   */
  it('não grava nada quando o bind falha', async () => {
    const sut = makeSut()
    sut.binds.execute.mockRejectedValue(new Error('App credentials not found'))

    await expect(
      sut.execute({
        settings: {
          prefixOperatorNameEnabled: true,
          messageDeleteEventEnabled: false,
        },
      }),
    ).rejects.toThrow('App credentials not found')

    expect(sut.updateSubscriptionItem).not.toHaveBeenCalled()
  })

  it('não grava nada quando o patch de settings vem vazio', async () => {
    const sut = makeSut()

    await sut.execute({ settings: {} })

    expect(sut.updateSubscriptionItem).not.toHaveBeenCalled()
    expect(sut.binds.execute).not.toHaveBeenCalled()
  })
})
