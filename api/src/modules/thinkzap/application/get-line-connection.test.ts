import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GetLineConnection } from './get-line-connection'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const zapiItem: SubscriptionItem = {
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

const input = {
  subscriptionItemId: 'i1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
}

function makeSut(subscription: Record<string, unknown> = { status: 'active' }) {
  const execute = vi.fn().mockResolvedValue({
    customer: { id: 'domain-1' },
    aplication: { id: 'installed-1', spaId: '42' },
    subscriptions: [{ id: 'sub-1', ...subscription, items: [zapiItem] }],
  })
  const getInstanceByInstanceId = vi.fn().mockResolvedValue(null)
  const getInstance = vi
    .fn()
    .mockResolvedValue({ connected: true, name: 'Instancia', token: 'tk' })
  const getPhoneData = vi.fn().mockResolvedValue({ phone: '5511999998888' })

  const disconnectExpiredLine = { schedule: vi.fn() }

  return {
    execute,
    getInstance,
    getPhoneData,
    disconnectExpiredLine,
    sut: new GetLineConnection(
      { execute } as never,
      { getInstance, getPhoneData } as never,
      disconnectExpiredLine as never,
    ),
  }
}

describe('GetLineConnection', () => {
  let ctx: ReturnType<typeof makeSut>

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = makeSut()
  })

  it('lê o estado da instância com a credencial resolvida do item', async () => {
    await ctx.sut.execute(input)

    expect(ctx.getInstance).toHaveBeenCalledWith('Z-1', 'TOKEN-SECRETO')
  })

  it('lê os dados do aparelho quando conectada', async () => {
    const reading = await ctx.sut.execute(input)

    expect(ctx.getPhoneData).toHaveBeenCalledWith('Z-1', 'TOKEN-SECRETO')
    expect(reading.phone).toMatchObject({ phone: '5511999998888' })
  })

  it('NÃO lê os dados do aparelho quando desconectada', async () => {
    ctx.getInstance.mockResolvedValue({ connected: false, token: 'tk' })

    const reading = await ctx.sut.execute(input)

    expect(ctx.getPhoneData).not.toHaveBeenCalled()
    expect(reading.phone).toBeNull()
  })

  it('degrada quando a leitura do aparelho devolve null', async () => {
    ctx.getPhoneData.mockResolvedValue(null)

    const reading = await ctx.sut.execute(input)

    expect(reading.instance).toMatchObject({ connected: true })
    expect(reading.phone).toBeNull()
  })

  it('propaga falha da leitura da instância em vez de dizer desconectada', async () => {
    ctx.getInstance.mockRejectedValue(new Error('Failed to get instance data'))

    await expect(ctx.sut.execute(input)).rejects.toThrow(
      'Failed to get instance data',
    )
  })

  it('propaga LineNotFoundError sem chamar a Z-API', async () => {
    await expect(
      ctx.sut.execute({ ...input, subscriptionItemId: 'de-outro' }),
    ).rejects.toBeInstanceOf(LineNotFoundError)
    expect(ctx.getInstance).not.toHaveBeenCalled()
  })

  it('funciona com linha não provisionada — a credencial vem do item', async () => {
    const reading = await ctx.sut.execute(input)

    expect(reading.instance).toMatchObject({ connected: true })
  })

  /**
   * A leitura não recusa por bloqueio — devolve o estado — e é o primeiro caminho a
   * perceber a expiração para quem abriu a tela em vez de receber mensagem.
   */
  describe('desconexão na expiração', () => {
    const expired = {
      status: 'trialing',
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
    }

    it('agenda a desconexão e reporta o entitlement, sem recusar', async () => {
      const sut = makeSut(expired)

      const reading = await sut.sut.execute(input)

      expect(reading.entitlement).toBe('trial-expired')
      expect(sut.disconnectExpiredLine.schedule).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'i1' }),
        'trial-expired',
      )
    })

    /**
     * `schedule` é síncrono e devolve `void`, então a resposta não tem o que
     * esperar. É o que permite uma leitura tocar o provider sem pagar a latência.
     */
    it('não espera o disconnect para responder', async () => {
      const sut = makeSut(expired)
      let settled = false
      sut.disconnectExpiredLine.schedule.mockImplementation(() => {
        // Efeito que nunca termina: se a resposta o esperasse, o teste travaria.
        void new Promise(() => {}).then(() => {
          settled = true
        })
      })

      await sut.sut.execute(input)

      expect(settled).toBe(false)
    })

    it('não agenda nada para linha habilitada', async () => {
      await ctx.sut.execute(input)

      expect(ctx.disconnectExpiredLine.schedule).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'i1' }),
        'active',
      )
    })
  })
})
