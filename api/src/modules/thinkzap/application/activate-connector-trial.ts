import { randomUUID } from 'node:crypto'

import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { PlanRepository } from '@/modules/application/domain/repositories/get-plan.repository'
import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import {
  TrialIneligibilityReason,
  checkTrialEligibility,
  trialWindow,
} from '@/modules/thinkzap/domain/connector-trial'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import { apiLogger } from '@/shared/infra/logger'
import { ensureTrialPlan } from './helpers/ensure-trial-plan'

export class TrialNotEligibleError extends Error {
  constructor(readonly reason: TrialIneligibilityReason) {
    super(
      reason === 'already-used'
        ? 'Esta instalação já usou o período de teste'
        : reason === 'has-contract'
          ? 'Esta instalação já tem assinatura'
          : 'Esta instalação não tem espelho na SPA de aplicações',
    )
    this.name = 'TrialNotEligibleError'
  }
}

export type ActivateConnectorTrialInput = {
  /** Uuid de `core_domains`, como vem no JWT. */
  domainId: string
  /** `core_app_codes.id`, como vem no JWT. */
  appCode: string
  provider: ConnectorProvider
}

export type ActivateConnectorTrialOutput = {
  subscriptionId: string
  item: SubscriptionItem
  currentPeriodEnd: Date
}

/**
 * Ativa o período de teste de uma instalação: uma assinatura `trialing` de 3 dias e
 * **uma** linha, com o recurso já provisionado no provider escolhido.
 *
 * Nada disso toca gateway de pagamento — o trial existe só na SPA.
 */
export class ActivateConnectorTrial {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly plans: PlanRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly items: SubscriptionItemRepository,
    private readonly providerResolver: ConnectorProviderResolver,
  ) {}

  async execute(
    input: ActivateConnectorTrialInput,
    now: Date = new Date(),
  ): Promise<ActivateConnectorTrialOutput> {
    const context = await this.getAplicationContext.execute({
      domainId: input.domainId,
      appCode: input.appCode,
    })

    /**
     * **Ordem obrigatória:** elegibilidade e plano antes de qualquer chamada ao
     * provider. Invertido, uma instalação inelegível deixaria recurso remoto
     * provisionado a cada tentativa — e o cliente pagaria por instância que nunca
     * seria usada.
     */
    const eligibility = checkTrialEligibility(context)
    if (!eligibility.eligible) {
      throw new TrialNotEligibleError(eligibility.reason)
    }

    const planId = await ensureTrialPlan(this.plans)

    // `spaId` é garantido pela elegibilidade: `no-spa-mirror` já teria barrado.
    const aplicationSpaId = context.aplication.spaId!

    /**
     * `provisionConnector` sim, `subscribe` **não**: `subscribe` liga a cobrança do
     * recurso no provider, e trial não é recurso pago. Sem essa distinção, 3 dias de
     * teste viram uma instância cobrada por mês.
     */
    const providerAdapter = this.providerResolver.resolve(input.provider)
    const resource = await providerAdapter.provisionConnector({
      name: `${context.customer.name} | trial-${randomUUID()}`,
    })

    const window = trialWindow(now)

    try {
      const subscription = await this.subscriptions.createSubscription({
        name: `Teste — ${context.aplication.title}`,
        planId,
        aplicationSpaId,
        status: 'trialing',
        ...window,
      })

      const item = await this.items.createSubscriptionItem({
        name: this.lineName(input.provider),
        subscription: subscription.id,
        status: 'active',
        metadata: this.toMetadata(input.provider, resource),
      })

      return {
        subscriptionId: subscription.id,
        item,
        currentPeriodEnd: window.currentPeriodEnd,
      }
    } catch (error) {
      /**
       * Recurso remoto criado e assinatura não: o trial não existe para o cliente,
       * mas o recurso existe no provider. Registrado em `error` com o identificador
       * para reconciliação manual — compensação transacional automática é escopo
       * próprio, e apagar recurso aqui poderia apagar o de outra tentativa.
       */
      apiLogger.error(
        {
          app: 'thinkzap',
          domainId: input.domainId,
          provider: input.provider,
          orphanRemoteId: resource.instanceId,
          err: error,
        },
        'Recurso provisionado no provider mas o trial não foi criado — recurso órfão',
      )
      throw error
    }
  }

  private lineName(provider: ConnectorProvider): string {
    return provider === ConnectorProvider.HUBMESSAGE
      ? 'WhatsApp Oficial (teste)'
      : 'WhatsApp (teste)'
  }

  /**
   * Credencial do recurso recém-provisionado, no formato que o item da SPA espera.
   *
   * Falta de credencial é erro, não item `NONE`: um item de trial sem credencial
   * seria uma linha que nunca conecta, e o cliente teria gastado o único teste dele.
   */
  private toMetadata(
    provider: ConnectorProvider,
    resource: {
      instanceId: string
      zApiToken?: string | null
      channelId?: string | null
      wabaId?: string | null
    },
  ): SubscriptionItem['metadata'] {
    if (provider === ConnectorProvider.HUBMESSAGE) {
      const channelId = resource.channelId ?? resource.instanceId
      if (!channelId || !resource.wabaId) {
        throw new Error(
          'Provisionamento HubMessage não devolveu canal e WABA — trial não criado',
        )
      }
      return {
        provider: 'HUBMESSAGE',
        hubmessageChannelId: channelId,
        wabaId: resource.wabaId,
      }
    }

    if (!resource.zApiToken) {
      throw new Error(
        'Provisionamento Z-API não devolveu token da instância — trial não criado',
      )
    }

    return {
      provider: 'ZAPI',
      zApiInstanceId: resource.instanceId,
      zApiInstanceToken: resource.zApiToken,
    }
  }
}
