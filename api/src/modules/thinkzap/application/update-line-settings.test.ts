import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdateLineSettings } from './update-line-settings'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const { apiLogger } = vi.hoisted(() => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

vi.mock('@/shared/infra/logger', () => ({ apiLogger }))

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

/** A mesma linha, do provider oficial: nome no item e sem espelho remoto. */
const oficial = (settings = DEFAULT_CONNECTOR_SETTINGS): SubscriptionItem => ({
  ...item(settings),
  metadata: { provider: 'HUBMESSAGE', hubmessageChannelId: 'CH-1' },
})

function makeSut(current = DEFAULT_CONNECTOR_SETTINGS) {
  const rename = { execute: vi.fn().mockResolvedValue(undefined) }
  const updateSubscriptionItem = vi.fn().mockResolvedValue(item(current))

  const useCase = new UpdateLineSettings(
    rename as never,
    { updateSubscriptionItem } as never,
  )

  return {
    rename,
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

  it('grava os dois toggles numa escrita só, no item da SPA', async () => {
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

  describe('nome da linha', () => {
    it('grava o nome no item e espelha na Z-API com o prefixo do host', async () => {
      const sut = makeSut()

      await sut.execute({ name: 'Comercial' })

      expect(sut.updateSubscriptionItem).toHaveBeenCalledWith('i1', {
        name: 'Comercial',
      })
      expect(sut.rename.execute).toHaveBeenCalledWith({
        zApiInstanceId: 'Z-1',
        zApiInstanceToken: 'TOKEN-SECRETO',
        domainName: 'acme.bitrix24.com.br',
        name: 'Comercial',
      })
    })

    it('grava apenas o nome quando o patch não traz settings', async () => {
      const sut = makeSut()

      await sut.execute({ name: 'Comercial' })

      expect(sut.updateSubscriptionItem).toHaveBeenCalledTimes(1)
      expect(sut.updateSubscriptionItem).toHaveBeenCalledWith('i1', {
        name: 'Comercial',
      })
    })

    /**
     * O nome já está gravado onde o produto lê. Falhar aqui deixaria o cliente sem
     * renomear a própria linha por causa do painel de um terceiro.
     */
    it('conclui com sucesso quando o espelho na Z-API falha', async () => {
      const sut = makeSut()
      sut.rename.execute.mockRejectedValue(new Error('z-api fora do ar'))

      await expect(sut.execute({ name: 'Comercial' })).resolves.toBeUndefined()

      expect(sut.updateSubscriptionItem).toHaveBeenCalledWith('i1', {
        name: 'Comercial',
      })
      expect(apiLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionItemId: 'i1',
          zApiInstanceId: 'Z-1',
          name: 'Comercial',
        }),
        expect.stringContaining('espelhado'),
      )
    })

    it('não espelha quando a gravação no item falha', async () => {
      const sut = makeSut()
      sut.updateSubscriptionItem.mockRejectedValue(new Error('bitrix fora'))

      await expect(sut.execute({ name: 'Comercial' })).rejects.toThrow(
        'bitrix fora',
      )

      expect(sut.rename.execute).not.toHaveBeenCalled()
    })

    it('grava o nome da linha oficial no item, sem chamar provider nenhum', async () => {
      const sut = makeSut()

      await sut.execute({ item: oficial(), name: 'Oficial Vendas' })

      expect(sut.updateSubscriptionItem).toHaveBeenCalledWith('i1', {
        name: 'Oficial Vendas',
      })
      expect(sut.rename.execute).not.toHaveBeenCalled()
    })
  })

  /**
   * Gravar settings **não sai da SPA**.
   *
   * Havia aqui três testes de bind/unbind no Bitrix: os toggles de sincronização de
   * edição e exclusão de mensagem tocavam o portal do cliente antes de persistir.
   * As duas sincronizações foram descontinuadas, e os toggles que restam são só
   * nossos — não há mais efeito colateral a cobrir.
   */
  it('gravar settings não toca o Bitrix', async () => {
    const sut = makeSut()

    await sut.execute({ settings: { prefixOperatorNameEnabled: true } })

    expect(sut.updateSubscriptionItem).toHaveBeenCalledWith('i1', {
      settings: {
        ...DEFAULT_CONNECTOR_SETTINGS,
        prefixOperatorNameEnabled: true,
        widgetOpenChannelEnabled: false,
      },
    })
  })

  it('não grava nada quando o patch de settings vem vazio', async () => {
    const sut = makeSut()

    await sut.execute({ settings: {} })

    expect(sut.updateSubscriptionItem).not.toHaveBeenCalled()
  })

  describe('limite diário', () => {
    it('ativa o limite de 300 na linha não oficial', async () => {
      const sut = makeSut()

      await sut.execute({
        settings: { dailyLimitEnabled: true, dailyLimit: 300 },
      })

      expect(sut.updateSubscriptionItem).toHaveBeenCalledWith('i1', {
        settings: {
          ...DEFAULT_CONNECTOR_SETTINGS,
          dailyLimitEnabled: true,
          dailyLimit: 300,
        },
      })
    })

    it('recusa limite 0 e não grava nada, nem o nome', async () => {
      const sut = makeSut()

      await expect(
        sut.execute({
          name: 'Novo nome',
          settings: { dailyLimitEnabled: true, dailyLimit: 0 },
        }),
      ).rejects.toMatchObject({
        errorCode: 'thinkzap.line.daily_limit_invalid',
      })
      expect(sut.updateSubscriptionItem).not.toHaveBeenCalled()
      expect(sut.rename.execute).not.toHaveBeenCalled()
    })

    it('recusa ligar o toggle sem limite gravado nem enviado', async () => {
      const sut = makeSut()

      await expect(
        sut.execute({ settings: { dailyLimitEnabled: true } }),
      ).rejects.toMatchObject({
        errorCode: 'thinkzap.line.daily_limit_invalid',
      })
    })

    it('aceita ligar o toggle quando a linha já tem limite gravado', async () => {
      const current = { ...DEFAULT_CONNECTOR_SETTINGS, dailyLimit: 250 }
      const sut = makeSut(current)

      await sut.execute({ settings: { dailyLimitEnabled: true } })

      expect(sut.updateSubscriptionItem).toHaveBeenCalledWith('i1', {
        settings: { ...current, dailyLimitEnabled: true },
      })
    })

    it('desligar mantém o valor gravado', async () => {
      const current = {
        ...DEFAULT_CONNECTOR_SETTINGS,
        dailyLimitEnabled: true,
        dailyLimit: 300,
      }
      const sut = makeSut(current)

      await sut.execute({ settings: { dailyLimitEnabled: false } })

      expect(sut.updateSubscriptionItem).toHaveBeenCalledWith('i1', {
        settings: { ...current, dailyLimitEnabled: false },
      })
    })

    it('recusa o limite na linha oficial', async () => {
      const sut = makeSut()

      await expect(
        sut.execute({
          item: oficial(),
          settings: { dailyLimitEnabled: true, dailyLimit: 300 },
        }),
      ).rejects.toMatchObject({
        errorCode: 'thinkzap.line.daily_limit_invalid',
      })
      expect(sut.updateSubscriptionItem).not.toHaveBeenCalled()
    })
  })
})
