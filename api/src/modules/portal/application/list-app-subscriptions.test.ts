import { describe, expect, it, vi } from 'vitest'
import { listAppSubscriptions } from './list-app-subscriptions'
import { AdminAppNotFoundError } from './helpers/resolve-admin-line'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'

const APP = {
  id: 'app-1',
  domainId: 'domain-1',
  appCodeId: 'crmthink.thinkzap',
}

const SUBSCRIPTION = {
  id: '1142-1',
  name: 'ThinkZap Mensal',
  status: 'active',
  modality: 'stripe',
  currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
  currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
  gatewayId: 'sub_123',
  plan: { name: 'Mensal', product: { name: 'ThinkZap' } },
  items: [
    {
      id: 'item-1',
      name: 'Linha Comercial',
      status: 'active',
      settings: { ...DEFAULT_CONNECTOR_SETTINGS },
      vinculatedChannel: null,
      metadata: {
        provider: 'ZAPI',
        zApiInstanceId: 'Z-1',
        zApiInstanceToken: 'TOKEN-SECRETO',
      },
    },
  ],
}

const deps = (
  context: unknown,
  installedApp: unknown = APP,
): { execute: ReturnType<typeof vi.fn>; deps: never } => {
  const execute = vi.fn().mockResolvedValue(context)

  return {
    execute,
    deps: {
      getApp: { getById: vi.fn().mockResolvedValue(installedApp) },
      getAplicationContext: { execute },
    } as never,
  }
}

const effects = (
  marks: Record<
    string,
    { subscribedAt?: string; unsubscribedAt?: string }
  > = {},
  providerEffectsEnabled = true,
) => ({
  mirrors: {
    find: vi.fn((itemId: string) =>
      Promise.resolve(
        itemId in marks
          ? {
              provider: 'ZAPI' as const,
              instanceId: 'Z',
              subscriptionId: 's',
              ...marks[itemId],
            }
          : null,
      ),
    ),
  },
  providerEffectsEnabled,
})

describe('listAppSubscriptions', () => {
  it('devolve as assinaturas da SPA com plano, modalidade e itens', async () => {
    const { deps: d } = deps({
      aplication: { spaId: '1060-1' },
      subscriptions: [SUBSCRIPTION],
    })

    const output = await listAppSubscriptions('app-1', d, effects())

    expect(output.mirrored).toBe(true)
    expect(output.subscriptions[0]).toMatchObject({
      id: '1142-1',
      status: 'active',
      modality: 'stripe',
      planName: 'Mensal',
      productName: 'ThinkZap',
      gatewayId: 'sub_123',
      currentPeriodEnd: '2026-09-01T00:00:00.000Z',
    })
    expect(output.subscriptions[0]?.items[0]).toMatchObject({
      id: 'item-1',
      status: 'active',
      metadata: { provider: 'ZAPI', zApiInstanceId: 'Z-1' },
    })
  })

  it('traz o estado no provider de cada linha pela marca do espelho', async () => {
    const second = {
      ...SUBSCRIPTION.items[0],
      id: 'item-2',
      metadata: { provider: 'HUBMESSAGE', hubmessageChannelId: 'C-1' },
    }
    const third = {
      ...SUBSCRIPTION.items[0],
      id: 'item-3',
      metadata: { provider: 'ZAPI', zApiInstanceId: 'Z-3' },
    }
    const { deps: d } = deps({
      aplication: { spaId: '1060-1' },
      subscriptions: [
        { ...SUBSCRIPTION, items: [...SUBSCRIPTION.items, second, third] },
      ],
    })

    const output = await listAppSubscriptions(
      'app-1',
      d,
      effects({
        'item-1': { subscribedAt: '2026-10-01T00:00:00.000Z' },
        'item-2': { unsubscribedAt: '2026-10-02T00:00:00.000Z' },
      }),
    )

    const items = output.subscriptions[0]?.items ?? []
    expect(items.map(item => item.providerBilling)).toEqual([
      'subscribed',
      'unsubscribed',
      'unknown',
    ])
    // Z-API sem token não tem credencial completa.
    expect(items.map(item => item.hasCredential)).toEqual([true, true, false])
  })

  it('falha do Redis na marca degrada para unknown, sem derrubar a aba', async () => {
    const { deps: d } = deps({
      aplication: { spaId: '1060-1' },
      subscriptions: [SUBSCRIPTION],
    })

    const output = await listAppSubscriptions('app-1', d, {
      mirrors: { find: vi.fn().mockRejectedValue(new Error('redis fora')) },
      providerEffectsEnabled: true,
    })

    expect(output.subscriptions[0]?.items[0]?.providerBilling).toBe('unknown')
  })

  it('informa quando os efeitos de provider estão desligados', async () => {
    const { deps: d } = deps({
      aplication: { spaId: '1060-1' },
      subscriptions: [],
    })

    const output = await listAppSubscriptions('app-1', d, effects({}, false))

    expect(output.providerEffectsEnabled).toBe(false)
  })

  it('não serializa a credencial do item', async () => {
    const { deps: d } = deps({
      aplication: { spaId: '1060-1' },
      subscriptions: [SUBSCRIPTION],
    })

    const output = await listAppSubscriptions('app-1', d, effects())

    expect(JSON.stringify(output)).not.toContain('TOKEN-SECRETO')
  })

  it('marca instalação sem espelho', async () => {
    const { deps: d } = deps({
      aplication: { spaId: null },
      subscriptions: [],
    })

    const output = await listAppSubscriptions('app-1', d, effects())

    expect(output).toEqual({
      mirrored: false,
      providerEffectsEnabled: true,
      subscriptions: [],
    })
  })

  it('distingue espelhada e sem contrato', async () => {
    const { deps: d } = deps({
      aplication: { spaId: '1060-1' },
      subscriptions: [],
    })

    const output = await listAppSubscriptions('app-1', d, effects())

    expect(output).toEqual({
      mirrored: true,
      providerEffectsEnabled: true,
      subscriptions: [],
    })
  })

  it('recusa instalação inexistente', async () => {
    const { deps: d, execute } = deps({}, null)

    await expect(listAppSubscriptions('app-1', d, effects())).rejects.toThrow(
      AdminAppNotFoundError,
    )
    expect(execute).not.toHaveBeenCalled()
  })

  it('propaga falha de leitura do Bitrix', async () => {
    const d = {
      getApp: { getById: vi.fn().mockResolvedValue(APP) },
      getAplicationContext: {
        execute: vi.fn().mockRejectedValue(new Error('bitrix fora')),
      },
    } as never

    await expect(listAppSubscriptions('app-1', d, effects())).rejects.toThrow(
      'bitrix fora',
    )
  })
})
