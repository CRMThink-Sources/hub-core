import type IORedis from 'ioredis'

import { GatewaySubscription } from '@/modules/application/domain/entities/gateway-subscription'
import { GatewaySubscriptionReader } from '@/modules/application/domain/repositories/gateway-subscription.reader'
import { apiLogger } from '@/shared/infra/logger'
import { gatewaySubscriptionKey } from './keys'
import { gatewaySubscriptionSchema } from './gateway-subscription.schema'

/**
 * TTL curto, ao contrário do preço.
 *
 * O preço muda por ação humana no painel do gateway, e uma hora de atraso só adia um
 * número na tela. A **quantidade** muda por operação do produto: criar linha chama
 * `syncSubscriptionLineItems`. O caminho principal contra o valor velho é a
 * invalidação explícita (`invalidate`), chamada por quem escreve; estes cinco minutos
 * são a rede para o que a aplicação não vê — quantidade editada direto no painel, ou
 * pelo portal de faturamento.
 */
const GATEWAY_SUBSCRIPTION_TTL_SECONDS = 5 * 60

/**
 * Cache de leitura da assinatura no gateway, por id da assinatura lá.
 *
 * A tela de conexões abre a cada navegação do operador, e sem cache cada abertura
 * custaria uma chamada ao gateway. Por id da assinatura, e não por instalação: as
 * assinaturas irmãs de um contrato compartilham o `gatewayId`, então um contrato de
 * dois planos usa uma entrada só.
 *
 * Falha de Redis nunca derruba a leitura, como nos outros decoradores daqui: vira
 * miss, com `warn`. O custo de um miss é uma chamada ao gateway; o custo de propagar
 * o erro seria a tela sem valor por causa do cache.
 */
export class CachedGatewaySubscriptionReader implements GatewaySubscriptionReader {
  constructor(
    private readonly inner: GatewaySubscriptionReader,
    private readonly redis: IORedis,
  ) {}

  async readSubscription(
    gatewaySubscriptionId: string,
  ): Promise<GatewaySubscription> {
    const key = gatewaySubscriptionKey(gatewaySubscriptionId)

    const cached = await this.read(key)
    if (cached) return cached

    const subscription = await this.inner.readSubscription(
      gatewaySubscriptionId,
    )
    await this.write(key, subscription)

    return subscription
  }

  /**
   * Descarta a entrada de uma assinatura.
   *
   * Chamado depois de a aplicação mudar o contrato no gateway. Sem isto, a tela
   * seguinte à criação de linha leria a quantidade antiga — e a linha recém-cobrada
   * apareceria como **bonificada**, que é o erro mais caro que esta change pode
   * produzir: o cliente veria de graça o que acabou de ser cobrado.
   *
   * Falha de Redis não propaga: a escrita no gateway já aconteceu, e derrubar o fluxo
   * por causa da limpeza do cache transformaria uma linha criada com sucesso em erro
   * na tela. O TTL cobre o resto.
   */
  async invalidate(gatewaySubscriptionId: string): Promise<void> {
    try {
      await this.redis.del(gatewaySubscriptionKey(gatewaySubscriptionId))
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', gatewaySubscriptionId, error },
        'Gateway subscription cache invalidation failed — falling back to TTL',
      )
    }
  }

  private async read(key: string): Promise<GatewaySubscription | null> {
    let hit: string | null
    try {
      hit = await this.redis.get(key)
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', key, error },
        'Gateway subscription cache read failed — falling back to gateway',
      )
      return null
    }

    if (!hit) return null

    let parsed: unknown
    try {
      parsed = JSON.parse(hit)
    } catch {
      return null
    }

    const result = gatewaySubscriptionSchema.safeParse(parsed)
    if (!result.success) {
      apiLogger.warn(
        { app: 'payments', key },
        'Gateway subscription cache entry has stale shape — treating as miss',
      )
      return null
    }

    return result.data
  }

  private async write(
    key: string,
    subscription: GatewaySubscription,
  ): Promise<void> {
    try {
      await this.redis.set(
        key,
        JSON.stringify(subscription),
        'EX',
        GATEWAY_SUBSCRIPTION_TTL_SECONDS,
      )
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', key, error },
        'Gateway subscription cache write failed — ignoring',
      )
    }
  }
}
