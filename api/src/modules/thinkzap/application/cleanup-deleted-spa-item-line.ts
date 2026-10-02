import {
  GetAplicationContext,
  SubscriptionWithItems,
} from '@/modules/application/application/get-aplication-context'
import { Subscription } from '@/modules/application/domain/entities/subscription'
import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import {
  SpaItemResourceMirror,
  SpaItemResourceMirrorRepository,
} from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import { isTrialStatus } from '@/modules/thinkzap/domain/connector-trial'
import { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import { PaymentGateway } from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '../errors/catalog'
import {
  PlanForProviderAmbiguousError,
  PlanForProviderMissingError,
  buildContractLineItems,
} from './helpers/build-contract-line-items'
import { ListOfferablePlans } from './list-offerable-plans'
import {
  ProviderResourceBilling,
  providerOf,
} from './provider-resource-billing'

export type CleanupDeletedSpaItemLineInput = {
  itemId: string
  traceKey: string
  /** Só quando a origem é `DeleteLine`; vão ao log via spread do input. */
  deletedBy?: string
  deletedAt?: string
}

export type CleanupDeletedSpaItemLineResult = {
  outcome: 'cleaned' | 'missing-mirror'
  billingAdjusted: boolean
}

// Item apagado: o espelho é a única fonte da credencial; unsubscribe + disconnect juntos.
// Falha propaga para a fila retentar; não retentar = seguir pagando o provider.
export class CleanupDeletedSpaItemLine {
  constructor(
    private readonly mirrors: SpaItemResourceMirrorRepository,
    private readonly providerBilling: ProviderResourceBilling,
    private readonly providerResolver: ConnectorProviderResolver,
    private readonly subscriptions: SubscriptionRepository,
    private readonly getAplicationContext: GetAplicationContext,
    private readonly plans: ListOfferablePlans,
    private readonly gateway: PaymentGateway | null,
  ) {}

  async execute(
    input: CleanupDeletedSpaItemLineInput,
  ): Promise<CleanupDeletedSpaItemLineResult> {
    const log = { app: 'thinkzap' as const, ...input }

    const mirror = await this.mirrors.find(input.itemId)

    if (!mirror) {
      // Legado sem espelho ou reentrega pós-limpeza: retentar não faz o espelho aparecer.
      apiLogger.warn(
        log,
        'Item apagado sem espelho do recurso — recurso possivelmente órfão no provider',
      )

      return { outcome: 'missing-mirror', billingAdjusted: false }
    }

    const provider = providerOf(mirror)
    const resourceLog = {
      ...log,
      provider: mirror.provider,
      resourceId: mirror.instanceId,
      subscriptionId: mirror.subscriptionId,
    }

    if (mirror.unsubscribedAt === undefined) {
      await this.providerBilling.unsubscribeResource(mirror, {
        origin: 'spa-item-deleted',
        propagate: true,
      })
    } else {
      apiLogger.debug(
        resourceLog,
        'Recurso já estava desassinado pelo status do item — só a sessão e a cobrança do contrato restam',
      )
    }

    await this.disconnect(mirror, resourceLog)

    const billingAdjusted = await this.reconcileBilling(mirror, resourceLog)

    // Por último: o retry da fila precisa do espelho para tentar de novo.
    await this.mirrors.remove(input.itemId)

    apiLogger.info(
      { ...resourceLog, billingAdjusted },
      'Recurso do item apagado limpo no provider',
    )

    return { outcome: 'cleaned', billingAdjusted }
  }

  private async disconnect(
    mirror: SpaItemResourceMirror,
    log: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.providerResolver.resolve(providerOf(mirror)).disconnect({
        instanceId: mirror.instanceId,
        ...(mirror.zApiToken !== undefined && { zApiToken: mirror.zApiToken }),
        ...(mirror.channelId !== undefined && { channelId: mirror.channelId }),
      })
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.provisioning.disconnect_expired_failed',
        { ...log, err: error },
        {
          level: 'error',
          msg: 'Falha ao desconectar a sessão do recurso apagado — a fila vai retentar',
        },
      )

      throw error
    }
  }

  /** Deriva das linhas que sobraram em vez de decrementar: decremento diverge em reentrega. */
  private async reconcileBilling(
    mirror: SpaItemResourceMirror,
    log: Record<string, unknown>,
  ): Promise<boolean> {
    const parent = await this.readParent(mirror, log)
    if (!parent) return false

    if (parent.modality !== 'stripe') {
      apiLogger.info(
        { ...log, modality: parent.modality },
        'Assinatura fora do gateway — recurso limpo e a cobrança é da automação de fora',
      )
      return false
    }

    if (isTrialStatus(parent.status) || !parent.gatewayId) {
      apiLogger.info(
        { ...log, status: parent.status },
        'Assinatura sem contrato pago no gateway — recurso limpo e nada a ajustar',
      )
      return false
    }

    if (parent.status === 'cancelled') {
      apiLogger.warn(
        log,
        'Assinatura já cancelada no gateway — recurso limpo e nenhuma cobrança ajustada',
      )
      return false
    }

    if (!this.gateway) {
      this.billingNotAdjusted(
        log,
        'gateway-not-configured',
        new Error('Gateway de pagamento não configurado neste ambiente'),
      )
      return false
    }

    const contract = await this.resolveContract(parent)

    let lineItems
    try {
      lineItems = buildContractLineItems({
        contract,
        offerablePlans: await this.plans.listOfferable(),
        plansForDiagnosis: await this.plans.listForDiagnosis(),
      }).lineItems
    } catch (error) {
      const reason =
        error instanceof PlanForProviderAmbiguousError
          ? 'plan-for-provider-ambiguous'
          : error instanceof PlanForProviderMissingError
            ? 'plan-for-provider-missing'
            : 'sync-failed'

      this.billingNotAdjusted(log, reason, error)

      return false
    }

    // Sync com lista vazia não remove nada: o cliente seguiria pagando o contrato cheio.
    if (lineItems.length === 0) {
      try {
        await this.gateway.cancelSubscriptionAtPeriodEnd(parent.gatewayId)
      } catch (error) {
        this.billingNotAdjusted(log, 'sync-failed', error)
        throw error
      }

      apiLogger.info(
        { ...log, gatewaySubscriptionId: parent.gatewayId },
        'Última linha do contrato apagada — assinatura encerra no fim do período vigente',
      )

      return true
    }

    try {
      await this.gateway.syncSubscriptionLineItems({
        gatewaySubscriptionId: parent.gatewayId,
        lineItems,
      })
    } catch (error) {
      // Sobe: o cliente segue pagando a linha apagada até o retry passar.
      this.billingNotAdjusted(log, 'sync-failed', error)
      throw error
    }

    apiLogger.info(
      { ...log, gatewaySubscriptionId: parent.gatewayId, lineItems },
      'Cobrança do contrato ajustada para a linha apagada',
    )

    return true
  }

  private async readParent(
    mirror: SpaItemResourceMirror,
    log: Record<string, unknown>,
  ): Promise<Subscription | null> {
    try {
      return await this.subscriptions.getSubscription(mirror.subscriptionId)
    } catch (error) {
      this.billingNotAdjusted(log, 'parent-read-failed', error)

      return null
    }
  }

  /** Cópia deliberada de `ProvisionLineFromSpaItem.resolveContract`: podem divergir. */
  private async resolveContract(
    parent: Subscription,
  ): Promise<SubscriptionWithItems[]> {
    const context = await this.getAplicationContext.execute({
      domainId: parent.aplication.customer.id,
      appCode: parent.aplication.appCode,
    })

    const siblings = context.subscriptions.filter(
      subscription =>
        subscription.id !== parent.id &&
        subscription.gatewayId === parent.gatewayId,
    )

    const hydratedParent = context.subscriptions.find(
      subscription => subscription.id === parent.id,
    )

    if (!hydratedParent) {
      apiLogger.warn(
        { app: 'thinkzap', subscriptionId: parent.id },
        'Assinatura pai não apareceu na listagem da instalação — contagem de linhas incompleta',
      )

      return [{ ...parent, items: [] }, ...siblings]
    }

    return [hydratedParent, ...siblings]
  }

  private billingNotAdjusted(
    log: Record<string, unknown>,
    reason: string,
    error: unknown,
  ): void {
    logThinkzapError(
      apiLogger,
      'thinkzap.subscription.manual_line_billing_not_adjusted',
      { ...log, reason, err: error },
      {
        level: 'error',
        msg: 'Recurso do item apagado limpo e cobrança do contrato não ajustada — o cliente segue pagando pela linha',
      },
    )
  }
}
