import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DisconnectExpiredLine } from './disconnect-expired-line'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const warn = vi.fn()
const info = vi.fn()
vi.mock('@/shared/infra/logger', () => ({
  apiLogger: {
    warn: (...args: unknown[]): void => {
      warn(...args)
    },
    info: (...args: unknown[]): void => {
      info(...args)
    },
    error: vi.fn(),
  },
}))

const zapiItem = (id = 'i1'): SubscriptionItem => ({
  id,
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
})

const hubItem = (id = 'i2'): SubscriptionItem => ({
  id,
  name: 'Linha oficial',
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

const noneItem = (id = 'i3'): SubscriptionItem => ({
  id,
  name: 'Item sem conector',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: { provider: 'NONE' },
})

function makeSut(options: { disconnectThrows?: boolean } = {}) {
  const provider = {
    disconnect: options.disconnectThrows
      ? vi.fn().mockRejectedValue(new Error('Failed to disconnect instance'))
      : vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    provisionConnector: vi.fn(),
    getConnectionStatus: vi.fn(),
  }

  const resolve = vi.fn().mockReturnValue(provider)

  return {
    provider,
    resolve,
    sut: new DisconnectExpiredLine({ resolve } as never),
  }
}

describe('DisconnectExpiredLine', () => {
  beforeEach(() => {
    warn.mockClear()
    info.mockClear()
  })

  describe('quando desconecta', () => {
    it('desconecta a instância Z-API com a credencial do item', async () => {
      const sut = makeSut()

      await sut.sut.execute(zapiItem())

      expect(sut.resolve).toHaveBeenCalledWith(ConnectorProvider.ZAPI)
      expect(sut.provider.disconnect).toHaveBeenCalledWith({
        instanceId: 'Z-1',
        zApiToken: 'TOKEN-SECRETO',
      })
    })

    it('desconecta o canal HubMessage pelo channelId do item', async () => {
      const sut = makeSut()

      await sut.sut.execute(hubItem())

      expect(sut.resolve).toHaveBeenCalledWith(ConnectorProvider.HUBMESSAGE)
      expect(sut.provider.disconnect).toHaveBeenCalledWith({
        instanceId: 'C-9',
        channelId: 'C-9',
      })
    })

    /**
     * `disconnect` é sessão, `unsubscribe` é cobrança. Trial nunca chamou
     * `subscribe` (decisão 4 do desenho), então não há assinatura no provider a
     * cancelar — e chamar `unsubscribe` aqui atacaria uma cobrança inexistente.
     */
    it('NUNCA chama unsubscribe', async () => {
      const sut = makeSut()

      await sut.sut.execute(zapiItem())
      await sut.sut.execute(hubItem())

      expect(sut.provider.unsubscribe).not.toHaveBeenCalled()
    })

    it('ignora item sem conector provisionado', async () => {
      const sut = makeSut()

      await sut.sut.execute(noneItem())

      expect(sut.resolve).not.toHaveBeenCalled()
      expect(sut.provider.disconnect).not.toHaveBeenCalled()
    })
  })

  describe('idempotência', () => {
    it('não repete o disconnect de um item já desconectado', () => {
      const sut = makeSut()

      sut.sut.schedule(zapiItem(), 'trial-expired')
      sut.sut.schedule(zapiItem(), 'trial-expired')
      sut.sut.schedule(zapiItem(), 'trial-expired')

      expect(sut.provider.disconnect).toHaveBeenCalledTimes(1)
    })

    /**
     * O memo guarda **sucesso**, não tentativa: sem job agendado, a resolução
     * seguinte é o único retry que existe.
     */
    it('tenta de novo depois de uma falha', async () => {
      const sut = makeSut({ disconnectThrows: true })

      await sut.sut.execute(zapiItem())
      await sut.sut.execute(zapiItem())

      expect(sut.provider.disconnect).toHaveBeenCalledTimes(2)
    })

    it('itens diferentes desconectam cada um', () => {
      const sut = makeSut()

      sut.sut.schedule(zapiItem('i1'), 'trial-expired')
      sut.sut.schedule(hubItem('i2'), 'trial-expired')

      expect(sut.provider.disconnect).toHaveBeenCalledTimes(2)
    })
  })

  describe('tolerância a falha', () => {
    it('não lança quando o provider falha', async () => {
      const sut = makeSut({ disconnectThrows: true })

      await expect(sut.sut.execute(zapiItem())).resolves.toBeUndefined()
    })

    it('registra warning, não erro — o bloqueio no app não depende disto', async () => {
      const sut = makeSut({ disconnectThrows: true })

      await sut.sut.execute(zapiItem())

      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionItemId: 'i1' }),
        expect.stringContaining('Falha ao desconectar'),
      )
    })
  })

  describe('schedule só age no entitlement expirado', () => {
    it('não desconecta linha habilitada', () => {
      const sut = makeSut()

      sut.sut.schedule(zapiItem(), 'active')

      expect(sut.provider.disconnect).not.toHaveBeenCalled()
    })

    /**
     * `inactive` fica de fora: assinatura cancelada ou vencida é decisão de
     * cobrança, e desconectar o número de um cliente pagante em atraso por conta
     * de uma leitura seria efeito bem maior que o bloqueio pede. Só trial vencido,
     * que é recurso que nós provisionamos e nunca foi cobrado.
     */
    it('não desconecta por assinatura inativa', () => {
      const sut = makeSut()

      sut.sut.schedule(zapiItem(), 'inactive')

      expect(sut.provider.disconnect).not.toHaveBeenCalled()
    })
  })

  /**
   * Uma leitura passou a poder tocar o provider, e não pode pagar a latência disso:
   * `schedule` devolve `void`, então não existe assinatura que permita a um chamador
   * esperar sem perceber.
   */
  it('schedule não devolve promessa para esperar', () => {
    const sut = makeSut()

    const returned: unknown = sut.sut.schedule(zapiItem(), 'trial-expired')

    expect(returned).toBeUndefined()
  })
})
