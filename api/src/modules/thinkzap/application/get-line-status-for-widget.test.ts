import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: {
    logLevel: 'silent',
    nodeEnv: 'test',
    zApi: { partnerToken: 'pt', clientToken: 'ct' },
  },
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { GetLineStatusForWidget } from './get-line-status-for-widget'

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

const hubItem: SubscriptionItem = {
  ...zapiItem,
  id: 'i_hub',
  name: 'Linha oficial',
  metadata: {
    provider: 'HUBMESSAGE',
    hubmessageChannelId: 'C-9',
    wabaId: 'W-9',
  },
}

const billingItem: SubscriptionItem = {
  ...zapiItem,
  id: 'i_none',
  metadata: { provider: 'NONE' },
}

const input = {
  subscriptionItemId: 'i1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
}

const activeSubscription = {
  status: 'active',
  currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
}

function makeSut(
  options: {
    subscription?: Record<string, unknown>
    items?: SubscriptionItem[]
  } = {},
) {
  const execute = vi.fn().mockResolvedValue({
    customer: { id: 'domain-1' },
    aplication: { id: 'installed-1', spaId: '42' },
    subscriptions: [
      {
        id: 'sub-1',
        ...(options.subscription ?? activeSubscription),
        items: options.items ?? [zapiItem, hubItem, billingItem],
      },
    ],
  })

  const getConnectionStatus = vi
    .fn()
    .mockResolvedValue({ connected: true, available: true })
  const resolve = vi.fn().mockReturnValue({ getConnectionStatus })

  return {
    execute,
    resolve,
    getConnectionStatus,
    sut: new GetLineStatusForWidget({ execute } as never, { resolve } as never),
  }
}

describe('GetLineStatusForWidget', () => {
  let ctx: ReturnType<typeof makeSut>

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = makeSut()
  })

  it('reporta conectada e leitura disponível, lendo pela credencial Z-API', async () => {
    await expect(ctx.sut.execute(input)).resolves.toEqual({
      connected: true,
      available: true,
    })

    expect(ctx.resolve).toHaveBeenCalledWith('ZAPI')
    expect(ctx.getConnectionStatus).toHaveBeenCalledWith({
      instanceId: 'Z-1',
      zApiToken: 'TOKEN-SECRETO',
    })
  })

  it('reporta desconectada com a leitura disponível', async () => {
    ctx.getConnectionStatus.mockResolvedValue({
      connected: false,
      available: true,
    })

    await expect(ctx.sut.execute(input)).resolves.toEqual({
      connected: false,
      available: true,
    })
  })

  /**
   * A lacuna que motivou o refactor: linha oficial caía em
   * `LineProviderNotSupportedError`, e o widget não conseguia avisar nada sobre ela —
   * justamente a linha que agora compõe template.
   */
  it('lê o status de linha HubMessage pelo canal e pela WABA', async () => {
    await expect(
      ctx.sut.execute({ ...input, subscriptionItemId: 'i_hub' }),
    ).resolves.toEqual({ connected: true, available: true })

    expect(ctx.resolve).toHaveBeenCalledWith('HUBMESSAGE')
    expect(ctx.getConnectionStatus).toHaveBeenCalledWith({
      instanceId: 'C-9',
      channelId: 'C-9',
      wabaId: 'W-9',
    })
  })

  it('reporta linha oficial desconectada', async () => {
    ctx.getConnectionStatus.mockResolvedValue({
      connected: false,
      available: true,
    })

    await expect(
      ctx.sut.execute({ ...input, subscriptionItemId: 'i_hub' }),
    ).resolves.toEqual({ connected: false, available: true })
  })

  it('repassa a indisponibilidade que o provider reporta', async () => {
    ctx.getConnectionStatus.mockResolvedValue({
      connected: false,
      available: false,
    })

    await expect(ctx.sut.execute(input)).resolves.toEqual({
      connected: false,
      available: false,
    })
  })

  /**
   * Degrada em vez de propagar: o widget precisa separar "está desconectada" de "não
   * deu para saber", porque só o primeiro caso vira aviso.
   */
  it('degrada para leitura indisponível quando a leitura falha', async () => {
    ctx.getConnectionStatus.mockRejectedValue(new Error('Failed to get status'))

    await expect(ctx.sut.execute(input)).resolves.toEqual({
      connected: false,
      available: false,
    })
  })

  /** Provider sem configuração de ambiente lança no resolver, não na leitura. */
  it('degrada quando o provider não está registrado', async () => {
    ctx.resolve.mockImplementation(() => {
      throw new Error('Provider não suportado')
    })

    await expect(ctx.sut.execute(input)).resolves.toEqual({
      connected: false,
      available: false,
    })
  })

  it('recusa linha bloqueada em vez de reportar status de conexão', async () => {
    const sut = makeSut({
      subscription: {
        status: 'trialing',
        currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
      },
    })

    await expect(sut.sut.execute(input)).rejects.toBeInstanceOf(
      LineBlockedError,
    )
    expect(sut.getConnectionStatus).not.toHaveBeenCalled()
  })

  it('recusa item fora da instalação do token', async () => {
    await expect(
      ctx.sut.execute({ ...input, subscriptionItemId: 'de-outro' }),
    ).rejects.toBeInstanceOf(LineNotFoundError)
    expect(ctx.getConnectionStatus).not.toHaveBeenCalled()
  })

  /** Item de cobrança sem conector não é linha e não tem status a reportar. */
  it('recusa item sem provider', async () => {
    await expect(
      ctx.sut.execute({ ...input, subscriptionItemId: 'i_none' }),
    ).rejects.toBeInstanceOf(LineProviderNotSupportedError)
    expect(ctx.getConnectionStatus).not.toHaveBeenCalled()
  })
})
