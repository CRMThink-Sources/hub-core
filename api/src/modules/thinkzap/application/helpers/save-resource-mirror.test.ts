import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveResourceMirror } from './save-resource-mirror'
import { SpaItemResourceMirrorRepository } from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { apiLogger } from '@/shared/infra/logger'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const makeMirrors = (options: { failing?: boolean } = {}) => {
  // Parâmetros declarados de propósito: sem eles `save.mock.calls` tipa como tupla vazia,
  // e o teste que afirma o valor gravado não compila.
  const save = vi.fn((_itemId: string, _mirror: Record<string, unknown>) =>
    options.failing
      ? Promise.reject(new Error('redis fora'))
      : Promise.resolve(),
  )

  return {
    mirrors: {
      find: vi.fn(),
      save,
      setBillingState: vi.fn(),
      remove: vi.fn(),
    } as unknown as SpaItemResourceMirrorRepository,
    save,
  }
}

describe('saveResourceMirror', () => {
  beforeEach(() => vi.clearAllMocks())

  it('grava instância, token e assinatura pai da linha Z-API', async () => {
    const { mirrors, save } = makeMirrors()

    await saveResourceMirror(mirrors, {
      itemId: '77',
      provider: ConnectorProvider.ZAPI,
      resource: { instanceId: 'inst-1', zApiToken: 'tok-1' },
      subscriptionId: '42',
    })

    expect(save).toHaveBeenCalledWith('77', {
      provider: 'ZAPI',
      instanceId: 'inst-1',
      zApiToken: 'tok-1',
      subscriptionId: '42',
    })
  })

  it('grava o canal nos dois campos na linha HubMessage', async () => {
    const { mirrors, save } = makeMirrors()

    await saveResourceMirror(mirrors, {
      itemId: '77',
      provider: ConnectorProvider.HUBMESSAGE,
      resource: { instanceId: 'chan-1', channelId: 'chan-1' },
      subscriptionId: '42',
    })

    expect(save).toHaveBeenCalledWith('77', {
      provider: 'HUBMESSAGE',
      instanceId: 'chan-1',
      channelId: 'chan-1',
      subscriptionId: '42',
    })
  })

  /**
   * Os adapters devolvem o canal em campos diferentes conforme o caminho de
   * provisionamento — criação nova traz `channelId`, retomada idempotente traz só
   * `instanceId`. O espelho tem que resolver os dois.
   */
  it('cai para instanceId quando o HubMessage não devolve channelId', async () => {
    const { mirrors, save } = makeMirrors()

    await saveResourceMirror(mirrors, {
      itemId: '77',
      provider: ConnectorProvider.HUBMESSAGE,
      resource: { instanceId: 'chan-1' },
      subscriptionId: '42',
    })

    expect(save).toHaveBeenCalledWith('77', {
      provider: 'HUBMESSAGE',
      instanceId: 'chan-1',
      channelId: 'chan-1',
      subscriptionId: '42',
    })
  })

  it('nasce sem marca de desassinado', async () => {
    const { mirrors, save } = makeMirrors()

    await saveResourceMirror(mirrors, {
      itemId: '77',
      provider: ConnectorProvider.ZAPI,
      resource: { instanceId: 'inst-1', zApiToken: 'tok-1' },
      subscriptionId: '42',
    })

    expect(Object.keys(save.mock.calls[0]![1])).not.toContain('unsubscribedAt')
  })

  /**
   * A ordem de gravidade que sustenta o `warn`: linha sem espelho é recuperável pelo
   * backfill; linha não provisionada é cliente pagando pelo que não recebeu.
   */
  it('não propaga falha de Redis — registra warn e segue', async () => {
    const { mirrors } = makeMirrors({ failing: true })

    await expect(
      saveResourceMirror(mirrors, {
        itemId: '77',
        provider: ConnectorProvider.ZAPI,
        resource: { instanceId: 'inst-1', zApiToken: 'tok-1' },
        subscriptionId: '42',
      }),
    ).resolves.toBeUndefined()

    expect(apiLogger.warn).toHaveBeenCalled()
  })
})
