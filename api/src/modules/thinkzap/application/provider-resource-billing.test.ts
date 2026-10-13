import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ProviderResourceBilling } from './provider-resource-billing'
import { apiLogger } from '@/shared/infra/logger'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import type { SpaItemResourceMirrorRepository } from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const itemWith = (
  metadata: SubscriptionItem['metadata'],
): SubscriptionItem => ({
  id: '77',
  name: 'Linha',
  subscription: '4242',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata,
})

const zApiItem = itemWith({
  provider: 'ZAPI',
  zApiInstanceId: 'inst-1',
  zApiInstanceToken: 'tok-1',
})

const hubItem = itemWith({
  provider: 'HUBMESSAGE',
  hubmessageChannelId: 'chan-1',
  wabaId: 'waba-1',
})

const noneItem = itemWith({ provider: 'NONE' })

const makeResolver = (options: { failing?: boolean } = {}) => {
  const failure = () => Promise.reject(new Error('provider fora'))

  const adapter = {
    provisionConnector: vi.fn(),
    subscribe: vi.fn(options.failing ? failure : () => Promise.resolve()),
    unsubscribe: vi.fn(options.failing ? failure : () => Promise.resolve()),
    disconnect: vi.fn(() => Promise.resolve()),
    getConnectionStatus: vi.fn(),
  }

  const resolve = vi.fn(() => adapter)

  return {
    resolver: { resolve } as unknown as ConnectorProviderResolver,
    resolve,
    adapter,
  }
}

describe('ProviderResourceBilling', () => {
  describe('subscribe', () => {
    it('resolve o adapter pelo provider da linha Z-API, com instância e token', async () => {
      const { resolver, resolve, adapter } = makeResolver()

      await new ProviderResourceBilling(resolver).subscribe(zApiItem)

      expect(resolve).toHaveBeenCalledWith(ConnectorProvider.ZAPI)
      expect(adapter.subscribe).toHaveBeenCalledWith({
        instanceId: 'inst-1',
        zApiToken: 'tok-1',
      })
    })

    it('resolve o adapter pelo provider da linha HubMessage, com o canal', async () => {
      const { resolver, resolve, adapter } = makeResolver()

      await new ProviderResourceBilling(resolver).subscribe(hubItem)

      expect(resolve).toHaveBeenCalledWith(ConnectorProvider.HUBMESSAGE)
      expect(adapter.subscribe).toHaveBeenCalledWith({
        instanceId: 'chan-1',
        channelId: 'chan-1',
      })
    })

    /**
     * Nunca lança: nesse ponto o cliente pagou e a linha funciona. Propagar
     * trocaria um chamado interno por um cliente sem serviço.
     */
    it('não lança quando o provider falha, e registra erro', async () => {
      const { resolver } = makeResolver({ failing: true })

      await expect(
        new ProviderResourceBilling(resolver).subscribe(zApiItem),
      ).resolves.toBeUndefined()

      expect(apiLogger.error).toHaveBeenCalled()
      const [payload] = vi.mocked(apiLogger.error).mock.calls.at(-1) ?? []
      expect(payload).toMatchObject({
        operation: 'subscribe',
        subscriptionItemId: '77',
        provider: ConnectorProvider.ZAPI,
        resourceId: 'inst-1',
      })
    })

    /** Item de cobrança sem conector: não há recurso a assinar. */
    it('não tenta nada em item sem credencial, e registra o caso', async () => {
      const { resolver, resolve } = makeResolver()

      await new ProviderResourceBilling(resolver).subscribe(noneItem)

      expect(resolve).not.toHaveBeenCalled()
      expect(apiLogger.warn).toHaveBeenCalled()
    })

    /** Assinar é cobrança; desconectar é sessão. Nunca a mesma operação. */
    it('não desconecta a sessão do cliente', async () => {
      const { resolver, adapter } = makeResolver()

      await new ProviderResourceBilling(resolver).subscribe(zApiItem)

      expect(adapter.disconnect).not.toHaveBeenCalled()
    })
  })

  describe('unsubscribe', () => {
    it('desassina a linha Z-API com motivo fixo', async () => {
      const { resolver, adapter } = makeResolver()

      await new ProviderResourceBilling(resolver).unsubscribe(zApiItem)

      expect(adapter.unsubscribe).toHaveBeenCalledWith(
        { instanceId: 'inst-1', zApiToken: 'tok-1' },
        expect.any(String),
      )
    })

    it('desassina a linha HubMessage com o canal', async () => {
      const { resolver, adapter } = makeResolver()

      await new ProviderResourceBilling(resolver).unsubscribe(hubItem)

      expect(adapter.unsubscribe).toHaveBeenCalledWith(
        { instanceId: 'chan-1', channelId: 'chan-1' },
        expect.any(String),
      )
    })

    /**
     * `error`, não `warn`: recurso não desassinado é continuar pagando ao provider
     * por cliente que saiu. Ninguém abre chamado por isso, então o log é o único
     * lugar onde aparece.
     */
    it('registra erro quando falha, sem lançar', async () => {
      const { resolver } = makeResolver({ failing: true })

      await expect(
        new ProviderResourceBilling(resolver).unsubscribe(hubItem),
      ).resolves.toBeUndefined()

      expect(apiLogger.error).toHaveBeenCalled()
      const [payload] = vi.mocked(apiLogger.error).mock.calls.at(-1) ?? []
      expect(payload).toMatchObject({
        operation: 'unsubscribe',
        provider: ConnectorProvider.HUBMESSAGE,
        resourceId: 'chan-1',
      })
    })

    /**
     * Desassinar **não** é desconectar: o recurso continua vivo e conectado até o
     * fim do período. Quem desconecta é o bloqueio terminal do entitlement, e
     * confundir os dois custa ao cliente uma releitura de QR code.
     */
    it('não chama disconnect como parte da operação', async () => {
      const { resolver, adapter } = makeResolver()

      await new ProviderResourceBilling(resolver).unsubscribe(zApiItem)

      expect(adapter.disconnect).not.toHaveBeenCalled()
    })

    it('não tenta nada em item sem credencial', async () => {
      const { resolver, resolve } = makeResolver()

      await new ProviderResourceBilling(resolver).unsubscribe(noneItem)

      expect(resolve).not.toHaveBeenCalled()
    })

    it('registra o skip de item sem credencial também com origem de SPA', async () => {
      const { resolver, resolve } = makeResolver()

      await new ProviderResourceBilling(resolver).unsubscribe(noneItem, {
        origin: 'spa-item-status',
        propagate: true,
      })

      expect(resolve).not.toHaveBeenCalled()
      expect(apiLogger.warn).toHaveBeenCalled()
    })
  })

  describe('origem e propagação', () => {
    it('mantém o texto do gateway quando a origem não é informada', async () => {
      const { resolver, adapter } = makeResolver()

      await new ProviderResourceBilling(resolver).unsubscribe(zApiItem)

      expect(adapter.unsubscribe).toHaveBeenCalledWith(
        expect.anything(),
        'Assinatura cancelada no ThinkZap',
      )
    })

    it('manda motivo distinto por origem, para o cancelamento ser rastreável no provider', async () => {
      const status = makeResolver()
      const deleted = makeResolver()

      await new ProviderResourceBilling(status.resolver).unsubscribe(zApiItem, {
        origin: 'spa-item-status',
      })
      await new ProviderResourceBilling(deleted.resolver).unsubscribeResource(
        {
          provider: 'ZAPI',
          instanceId: 'inst-1',
          zApiToken: 'tok-1',
        },
        { origin: 'spa-item-deleted' },
      )

      // `vi.fn` sem parâmetros declarados tipa `calls` como tupla vazia; o argumento
      // real existe, e é ele que o teste compara.
      const reasonOf = (spy: { mock: { calls: unknown[][] } }) =>
        spy.mock.calls[0]?.[1]

      const statusReason = reasonOf(status.adapter.unsubscribe)
      const deletedReason = reasonOf(deleted.adapter.unsubscribe)

      expect(statusReason).not.toBe(deletedReason)
      expect(statusReason).toEqual(expect.any(String))
      expect(deletedReason).toEqual(expect.any(String))
    })

    it('identifica o cancelamento da assinatura no CRM', async () => {
      const { resolver, adapter } = makeResolver()

      await new ProviderResourceBilling(resolver).unsubscribeResource(
        { provider: 'HUBMESSAGE', instanceId: 'chan-1', channelId: 'chan-1' },
        { origin: 'subscription-cancelled' },
      )

      expect(adapter.unsubscribe).toHaveBeenCalledWith(
        { instanceId: 'chan-1', channelId: 'chan-1' },
        'Assinatura cancelada no CRM',
      )
    })

    it('engole a falha por padrão — o chamador do gateway está dentro de um webhook', async () => {
      const { resolver } = makeResolver({ failing: true })

      await expect(
        new ProviderResourceBilling(resolver).unsubscribe(zApiItem),
      ).resolves.toBeUndefined()
      expect(apiLogger.error).toHaveBeenCalled()
    })

    it('propaga a falha quando pedido, para a fila retentar', async () => {
      const { resolver } = makeResolver({ failing: true })

      await expect(
        new ProviderResourceBilling(resolver).unsubscribe(zApiItem, {
          origin: 'spa-item-status',
          propagate: true,
        }),
      ).rejects.toThrow('provider fora')
      // O log sai de qualquer forma: propagar é sobre quem retenta, não sobre registro.
      expect(apiLogger.error).toHaveBeenCalled()
    })

    it('opera pela credencial solta, sem item — o caminho da exclusão', async () => {
      const { resolver, adapter, resolve } = makeResolver()

      await new ProviderResourceBilling(resolver).unsubscribeResource(
        { provider: 'HUBMESSAGE', instanceId: 'chan-1', channelId: 'chan-1' },
        { origin: 'spa-item-deleted', propagate: true },
      )

      expect(resolve).toHaveBeenCalledWith(ConnectorProvider.HUBMESSAGE)
      expect(adapter.unsubscribe).toHaveBeenCalledWith(
        { instanceId: 'chan-1', channelId: 'chan-1' },
        expect.any(String),
      )
    })

    it('reassina pela credencial solta', async () => {
      const { resolver, adapter } = makeResolver()

      await new ProviderResourceBilling(resolver).subscribeResource({
        provider: 'ZAPI',
        instanceId: 'inst-1',
        zApiToken: 'tok-1',
      })

      expect(adapter.subscribe).toHaveBeenCalledWith({
        instanceId: 'inst-1',
        zApiToken: 'tok-1',
      })
    })
  })

  /**
   * A marca é o que impede o UPDATE seguinte do item — o próprio checkout escreve na
   * SPA — de assinar de novo o que acabou de ser assinado aqui.
   */
  describe('marca de cobrança no espelho', () => {
    const makeMirrors = (failing = false) => {
      const setBillingState = vi.fn(() =>
        failing ? Promise.reject(new Error('redis fora')) : Promise.resolve(),
      )
      return {
        mirrors: {
          setBillingState,
        } as unknown as SpaItemResourceMirrorRepository,
        setBillingState,
      }
    }

    it('marca assinado depois do subscribe bem-sucedido', async () => {
      const { resolver } = makeResolver()
      const { mirrors, setBillingState } = makeMirrors()

      await new ProviderResourceBilling(resolver, mirrors).subscribe(zApiItem)

      expect(setBillingState).toHaveBeenCalledWith('77', 'subscribed')
    })

    it('marca desassinado depois do unsubscribe bem-sucedido', async () => {
      const { resolver } = makeResolver()
      const { mirrors, setBillingState } = makeMirrors()

      await new ProviderResourceBilling(resolver, mirrors).unsubscribe(hubItem)

      expect(setBillingState).toHaveBeenCalledWith('77', 'unsubscribed')
    })

    it('não marca quando o provider falha', async () => {
      const { resolver } = makeResolver({ failing: true })
      const { mirrors, setBillingState } = makeMirrors()

      await new ProviderResourceBilling(resolver, mirrors).subscribe(zApiItem)

      expect(setBillingState).not.toHaveBeenCalled()
    })

    it('não marca item sem credencial', async () => {
      const { resolver } = makeResolver()
      const { mirrors, setBillingState } = makeMirrors()

      await new ProviderResourceBilling(resolver, mirrors).subscribe(noneItem)

      expect(setBillingState).not.toHaveBeenCalled()
    })

    it('falha ao marcar vira warn e não desfaz a ativação', async () => {
      const { resolver, adapter } = makeResolver()
      const { mirrors } = makeMirrors(true)

      await expect(
        new ProviderResourceBilling(resolver, mirrors).subscribe(zApiItem),
      ).resolves.toBeUndefined()

      expect(adapter.subscribe).toHaveBeenCalled()
      expect(apiLogger.warn).toHaveBeenCalled()
    })
  })
})

/**
 * A separação dos eixos, verificada sobre o texto: este módulo é o do ciclo de
 * **cobrança**, e nada nele chama `disconnect`. É a confusão mais fácil de cometer
 * na área, porque os três métodos vivem no mesmo adapter.
 */
describe('provider-resource-billing (estrutura)', () => {
  const source = readFileSync(
    join(__dirname, 'provider-resource-billing.ts'),
    'utf8',
  )
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')

  it('não chama disconnect em nenhum caminho', () => {
    expect(code).not.toMatch(/\.disconnect\(/)
  })
})
