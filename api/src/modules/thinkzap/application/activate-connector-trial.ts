import { randomUUID } from 'node:crypto'

import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { PlanRepository } from '@/modules/application/domain/repositories/get-plan.repository'
import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { SpaItemResourceMirrorRepository } from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import {
  TrialIneligibilityReason,
  checkTrialEligibility,
  trialWindow,
} from '@/modules/thinkzap/domain/connector-trial'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import { SpaClientContact } from '@/shared/domain/entities/spa-client-contact'
import { UpdateSpaClientContactRepository } from '@/shared/domain/repositories/spa/spa-client-contact.repository'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '../errors/catalog'
import { ensureTrialPlan } from './helpers/ensure-trial-plan'
import { toLineMetadata } from './helpers/line-resource-metadata'
import { saveResourceMirror } from './helpers/save-resource-mirror'

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

/**
 * Gravação do contato falhou, e o teste não começou.
 *
 * Erro próprio e não reaproveitamento de `trial_activation_failed`: aquele é
 * `internal` e diz "tente de novo"; este é o CRM interno indisponível na escrita
 * do item de cliente — retentável, e o runbook manda checar a instância interna.
 */
export class TrialContactWriteFailedError extends Error {
  constructor(readonly cause: unknown) {
    super('Não foi possível registrar os dados de contato para iniciar o teste')
    this.name = 'TrialContactWriteFailedError'
  }
}

export type ActivateConnectorTrialInput = {
  /** Uuid de `core_domains`, como vem no JWT. */
  domainId: string
  /** `core_app_codes.id`, como vem no JWT. */
  appCode: string
  provider: ConnectorProvider
  /** Já validado e com o telefone normalizado por `parseTrialContact`. */
  contact: SpaClientContact
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
    private readonly contacts: UpdateSpaClientContactRepository,
    /** Espelho do recurso — a cópia da credencial que sobrevive ao item apagado. */
    private readonly mirrors: SpaItemResourceMirrorRepository,
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
     * **Depois** de elegibilidade e plano, e **antes** do provider.
     *
     * Depois dos dois primeiros porque instalação inelegível não deve virar lead:
     * ela não vai ativar teste nenhum, e o CRM encheria de ruído a cada tentativa.
     *
     * Antes do provider porque contato salvo é lead capturado. Se o
     * provisionamento falhar depois, o comercial tem para quem ligar — e é
     * exatamente a tentativa que falhou que mais precisa de atendimento humano.
     * A instalação continua elegível (nenhuma assinatura foi criada), então a
     * retentativa reescreve o mesmo contato: idempotente.
     */
    try {
      await this.contacts.updateContact(aplicationSpaId, input.contact)
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.subscription.trial_contact_failed',
        { app: 'thinkzap', domainId: input.domainId, err: error },
        {
          level: 'error',
          msg: 'Contato não gravado no item de cliente — trial abortado antes de provisionar',
        },
      )
      throw new TrialContactWriteFailedError(error)
    }

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
        /**
         * Helper compartilhado com a criação de linha adicional, e não cópia local: a
         * cópia que existia aqui exigia a WABA no provisionamento HubMessage — que o
         * provider nunca devolve —, e por isso **nenhum trial oficial conseguia ser
         * ativado**. Uma regra, um lugar.
         */
        metadata: toLineMetadata(input.provider, resource),
      })

      /**
       * Espelho do recurso, depois de o item existir. O trial é o caminho que mais
       * abandona recurso — instalação que testa e desaparece —, então é justamente aqui
       * que a credencial precisa sobreviver a alguém apagando o item no CRM.
       */
      await saveResourceMirror(this.mirrors, {
        itemId: item.id,
        provider: input.provider,
        resource,
        subscriptionId: subscription.id,
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
      logThinkzapError(
        apiLogger,
        'thinkzap.subscription.trial_activation_failed',
        {
          app: 'thinkzap',
          domainId: input.domainId,
          provider: input.provider,
          orphanRemoteId: resource.instanceId,
          err: error,
        },
        {
          level: 'error',
          msg: 'Recurso provisionado no provider mas o trial não foi criado — recurso órfão',
        },
      )
      throw error
    }
  }

  private lineName(provider: ConnectorProvider): string {
    return provider === ConnectorProvider.HUBMESSAGE
      ? 'WhatsApp Oficial (teste)'
      : 'WhatsApp (teste)'
  }
}
