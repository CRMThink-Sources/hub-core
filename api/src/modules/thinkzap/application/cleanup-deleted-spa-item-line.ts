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
  /** Id do item apagado na SPA 1146, como vem no evento do webhook. */
  itemId: string
  /** Correlação com a linha do webhook que originou o job. */
  traceKey: string
}

export type CleanupDeletedSpaItemLineResult = {
  outcome: /** Recurso desassinado e desconectado, espelho apagado. */
    | 'cleaned'
    /** Sem espelho: recurso irresolvível, e é o que o log nomeia. */
    | 'missing-mirror'
  /** `true` quando os `line_items` do contrato foram sincronizados. */
  billingAdjusted: boolean
}

/**
 * Limpa o recurso remoto de um item **apagado** na SPA 1146.
 *
 * ```
 * 1. lê o espelho                      ← ausente: recurso órfão, nomeado no log
 * 2. unsubscribe no provider           ← falha: sobe, e a fila retenta
 * 3. disconnect no provider            ← falha: sobe, e a fila retenta
 * 4. reconcilia line_items no gateway  ← falha: sobe; o recurso já foi desassinado
 * 5. apaga o espelho                   ← por último, para o retry reencontrar o dado
 * ```
 *
 * **O espelho é a única fonte possível.** O item já não existe, então a credencial que
 * vivia nele (`ufCrm93ZApiInstanceId`, `ufCrm93HubChanelId`) morreu junto, e a leitura no
 * Bitrix devolve 404 por construção. É por isso que o espelho existe.
 *
 * **É o único caso em que os dois eixos terminam juntos.**
 * `provider-resource-billing-lifecycle` separa `unsubscribe` (a cobrança do recurso para
 * nós) de `disconnect` (a sessão do WhatsApp do cliente), e o resto do sistema respeita
 * isso. Aqui não há mais item a reativar, então preservar a sessão não protege nada.
 *
 * **`unsubscribe` não destrói o recurso**, e este caso de uso não pretende destruí-lo:
 * ele agenda o fim da cobrança para o vencimento do período. A remoção física continua
 * sem método no contrato de provider, e continua dívida de
 * `cleanup-orphan-trial-resources`.
 *
 * **Falha propaga**, ao contrário de `ProvisionLineFromSpaItem`. Lá o retry decidiria a
 * mesma coisa; aqui cada passo é uma ida à rede que pode simplesmente ter falhado, e o
 * custo de não repetir é continuar pagando ao provider por uma linha apagada.
 */
export class CleanupDeletedSpaItemLine {
  constructor(
    private readonly mirrors: SpaItemResourceMirrorRepository,
    private readonly providerBilling: ProviderResourceBilling,
    private readonly providerResolver: ConnectorProviderResolver,
    private readonly subscriptions: SubscriptionRepository,
    private readonly getAplicationContext: GetAplicationContext,
    private readonly plans: ListOfferablePlans,
    /** `null` sem gateway configurado — ver `ProvisionLineFromSpaItem`. */
    private readonly gateway: PaymentGateway | null,
  ) {}

  async execute(
    input: CleanupDeletedSpaItemLineInput,
  ): Promise<CleanupDeletedSpaItemLineResult> {
    const log = { app: 'thinkzap' as const, ...input }

    // ── Passo 1: o espelho, única fonte da credencial de um item que não existe mais.
    const mirror = await this.mirrors.find(input.itemId)

    if (!mirror) {
      /**
       * Duas coisas chegam aqui e não são distinguíveis: item provisionado antes de o
       * espelho existir (passivo legado, que o backfill resolve) e reentrega do delete
       * depois de a limpeza ter concluído. Distinguir exigiria guardar um túmulo por item
       * apagado; encerrar com sucesso é o certo nos dois casos, porque retentar não faz
       * espelho aparecer.
       *
       * `warn` com o id em campo estruturado é o que torna o passivo **contável** — a
       * varredura reversa do provider, que o resolveria de vez, é dívida registrada.
       */
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

    // ── Passo 2: a cobrança do recurso para nós. Pulada quando o caminho de status já a
    // encerrou — repetir seria uma ida à rede sem efeito.
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

    // ── Passo 3: a sessão do cliente.
    await this.disconnect(mirror, resourceLog)

    // ── Passo 4: a cobrança do contrato, pelas linhas que sobraram.
    const billingAdjusted = await this.reconcileBilling(mirror, resourceLog)

    /**
     * ── Passo 5: o espelho sai por último. Uma falha em qualquer passo acima deixa a
     * chave onde está, e é ela que o retry da fila precisa para tentar de novo.
     */
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

  /**
   * Leva os `line_items` do contrato pai ao estado das linhas que **sobraram**.
   *
   * Derivar em vez de decrementar é o que mantém subida e descida no mesmo caminho: os
   * itens vêm de `GetAplicationContext`, o apagado simplesmente não está mais lá, e a
   * quantidade cai por consequência. Um decremento divergiria do estado real na primeira
   * exclusão perdida ou reentregue.
   *
   * As guardas são as mesmas de `ProvisionLineFromSpaItem`, e a simetria é deliberada:
   * modalidade fora do gateway, contrato em trial e gateway não configurado significam
   * "não há `line_item` nosso a ajustar" nos dois sentidos.
   */
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

    if (parent.status === 'trialing' || !parent.gatewayId) {
      apiLogger.info(
        { ...log, status: parent.status },
        'Assinatura sem contrato pago no gateway — recurso limpo e nada a ajustar',
      )
      return false
    }

    if (parent.status === 'cancelled') {
      /**
       * `warn`: não há `line_item` a alterar, mas recurso sendo limpo sob contrato
       * encerrado é estado que alguém precisa ver.
       */
      apiLogger.warn(
        log,
        'Assinatura já cancelada no gateway — recurso limpo e nenhuma cobrança ajustada',
      )
      return false
    }

    if (!this.gateway) {
      /**
       * Configuração incompleta nossa, não estado do cliente — e o recurso já foi
       * desassinado, então não há o que retentar aqui. Sucesso com a pendência nomeada.
       */
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
      /**
       * Catálogo ambíguo ou incompleto é recusa, não escolha — mesma postura da subida.
       * O recurso já foi desassinado; o que fica pendente é o ajuste de quantidade.
       */
      const reason =
        error instanceof PlanForProviderAmbiguousError
          ? 'plan-for-provider-ambiguous'
          : error instanceof PlanForProviderMissingError
            ? 'plan-for-provider-missing'
            : 'sync-failed'

      this.billingNotAdjusted(log, reason, error)

      return false
    }

    /**
     * Não sobrou linha nenhuma: o contrato inteiro acabou, e sincronizar não resolve.
     *
     * `syncSubscriptionLineItems` não remove preço ausente da lista — está escrito no
     * port, e é a decisão certa lá, porque reduzir cobrança não pode ser efeito
     * colateral de acrescentar linha. O efeito aqui seria o pior possível: lista
     * vazia significa "nada a mudar", e o cliente seguiria pagando o contrato cheio
     * por linha nenhuma.
     *
     * Encerra no fim do período. Ver o port para o porquê de não ser imediato.
     *
     * **Um plano zerado não é contrato vazio.** Contrato de dois planos onde a
     * exclusão zera um deles ainda deriva um `line_item`, e cai na reconciliação
     * normal logo abaixo. Só a lista inteiramente vazia chega aqui.
     */
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
      /**
       * Sobe: o cliente continua pagando pela linha apagada até este ajuste passar, e o
       * retry da fila é o que fecha isso. Desassinar de novo no provider, se o retry
       * repetir o passo 2, é inofensivo — e ele nem repete, porque a marca já está lá.
       */
      this.billingNotAdjusted(log, 'sync-failed', error)
      throw error
    }

    apiLogger.info(
      { ...log, gatewaySubscriptionId: parent.gatewayId, lineItems },
      'Cobrança do contrato ajustada para a linha apagada',
    )

    return true
  }

  /**
   * A assinatura pai, pelo id que o espelho guardou.
   *
   * Ausente é possível: a assinatura pode ter sido apagada junto com os itens, e nesse
   * caso não há contrato a ajustar — o caminho da SPA 1142 é outro.
   */
  private async readParent(
    mirror: SpaItemResourceMirror,
    log: Record<string, unknown>,
  ): Promise<Subscription | null> {
    try {
      return await this.subscriptions.getSubscription(mirror.subscriptionId)
    } catch (error) {
      apiLogger.warn(
        { ...log, err: error },
        'Assinatura pai do item apagado não pôde ser lida — recurso limpo e nenhuma cobrança ajustada',
      )

      return null
    }
  }

  /**
   * O contrato do pai: ele mais as irmãs que compartilham o mesmo `gatewayId`.
   *
   * Cópia deliberada de `ProvisionLineFromSpaItem.resolveContract`, e não extração: os
   * dois lados vão divergir se a contagem passar a considerar estado do item, e a subida
   * é o caminho quente que não deve mudar de comportamento por causa deste.
   */
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
