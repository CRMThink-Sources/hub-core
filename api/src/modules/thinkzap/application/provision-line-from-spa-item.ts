import { randomUUID } from 'node:crypto'

import {
  GetAplicationContext,
  SubscriptionWithItems,
} from '@/modules/application/application/get-aplication-context'
import { Subscription } from '@/modules/application/domain/entities/subscription'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { SpaItemResourceMirrorRepository } from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import { isTrialStatus } from '@/modules/thinkzap/domain/connector-trial'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import { PaymentGateway } from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import type { RawSubscriptionItemReader } from '@/modules/thinkzap/domain/ports/raw-subscription-item-reader.port'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '../errors/catalog'
import {
  PlanForProviderAmbiguousError,
  PlanForProviderMissingError,
  buildContractLineItems,
} from './helpers/build-contract-line-items'
import { resourceRefOf, toLineMetadata } from './helpers/line-resource-metadata'
import { saveResourceMirror } from './helpers/save-resource-mirror'
import { resolveProvisioningAction } from './helpers/resolve-provisioning-action'
import { ListOfferablePlans } from './list-offerable-plans'
import { ProviderResourceBilling } from './provider-resource-billing'

export type ProvisionLineFromSpaItemInput = {
  /** Id do item na SPA 1146, como vem no evento do webhook. */
  itemId: string
  /** Correlação com a linha do webhook que originou o job. */
  traceKey?: string
}

/** O que aconteceu, para o worker registrar sem reinterpretar o log. */
export type ProvisionLineFromSpaItemResult = {
  outcome:
    | 'provisioned'
    | 'already-provisioned'
    | 'no-connector'
    | 'refused'
    | 'missing-item'
    /** Recurso criado no provider e credencial não gravada: órfão, pago por nós. */
    | 'orphaned'
  /** `true` quando os `line_items` do contrato foram sincronizados. */
  billingAdjusted: boolean
}

/**
 * Provisiona o conector de um item de assinatura **criado à mão** na SPA 1146 e
 * reconcilia a cobrança do contrato dele.
 *
 * Existe porque criar linha era um fluxo fechado dentro do produto: `CreateAdditionalLine`
 * está atrás de JWT de instalação, e quem opera o CRM interno não passa por lá. Um item
 * criado à mão nascia **morto e ilegal** — provider declarado sem credencial faz
 * `resolveMetadata` recusar o item, e como a listagem mapeia item por item, isso derruba
 * a leitura da assinatura inteira.
 *
 * A ordem dos passos:
 *
 * ```
 * 1. lê o item cru                     ← falha: nada aconteceu
 * 2. lê a assinatura pai               ← falha: nada aconteceu
 * 3. provisiona no provider            ← falha: nada aconteceu, nada foi cobrado
 * 4. grava metadata na SPA             ← falha: RECURSO ÓRFÃO, nós pagamos
 * 5. reconcilia line_items no gateway  ← falha: linha viva não cobrada
 * 6. subscribe no provider             ← nunca lança
 * ```
 *
 * **Os passos 4 e 5 estão invertidos em relação a `CreateAdditionalLine`**, que cobra
 * antes de escrever na SPA. Lá o risco é "cliente pagou e não tem a linha", visível para
 * quem pagou no mesmo minuto. Aqui não há cliente esperando — o gatilho é ato de operador
 * —, e o pior estado é o item continuar ilegal para a leitura, que derruba a listagem da
 * instalação inteira. Gravar a credencial primeiro fecha esse buraco na primeira coisa
 * que pode dar certo.
 *
 * A inversão também é **obrigatória** por outro motivo: a contagem de linhas do contrato
 * precisa ler os itens pelo repositório de domínio, e enquanto este item estiver sem
 * credencial essa leitura lança. Montar a cobrança antes de gravar seria impossível.
 *
 * **Nada aqui lança.** O chamador é um worker de fila, o webhook já respondeu 200, e cada
 * desfecho ruim tem um código de erro próprio no catálogo. Propagar só faria o BullMQ
 * repetir um job que vai decidir a mesma coisa — exceto nas falhas de rede, onde o retry
 * ajuda, e essas são justamente as que sobem (ver `provision` e `sync`).
 */
export class ProvisionLineFromSpaItem {
  constructor(
    private readonly rawItems: RawSubscriptionItemReader,
    private readonly subscriptions: SubscriptionRepository,
    private readonly items: SubscriptionItemRepository,
    private readonly getAplicationContext: GetAplicationContext,
    private readonly plans: ListOfferablePlans,
    /**
     * `null` quando o gateway não está configurado no ambiente. Provisionar **não**
     * depende dele: uma instalação inteira pode viver na modalidade boleto, e exigir
     * chave do gateway aqui deixaria a linha manual sem recurso por uma configuração
     * que não a governa.
     */
    private readonly gateway: PaymentGateway | null,
    private readonly providerResolver: ConnectorProviderResolver,
    private readonly providerBilling: ProviderResourceBilling,
    /**
     * O espelho do recurso, gravado junto da credencial no item. É a única cópia que
     * sobrevive ao item apagado, e sem ela a exclusão desta linha registraria recurso
     * órfão em vez de limpá-lo.
     */
    private readonly mirrors: SpaItemResourceMirrorRepository,
  ) {}

  async execute(
    input: ProvisionLineFromSpaItemInput,
  ): Promise<ProvisionLineFromSpaItemResult> {
    const log = { app: 'thinkzap' as const, ...input }

    // ── Passo 1: o item cru. Não passa pelo mapper de domínio de propósito.
    const raw = await this.rawItems.getRawSubscriptionItem(input.itemId)

    if (!raw) {
      /**
       * Item apagado entre o evento e a execução: `warn`, não `error`. É corrida
       * normal — alguém criou e desfez —, e não há recurso nem cobrança pendentes.
       */
      apiLogger.warn(
        log,
        'Item de assinatura não existe mais — nada a provisionar',
      )

      return { outcome: 'missing-item', billingAdjusted: false }
    }

    const action = resolveProvisioningAction(raw)

    if (action.kind === 'refuse') {
      this.refused(log, action.reason, action.detail)

      return { outcome: 'refused', billingAdjusted: false }
    }

    if (action.kind === 'no-connector') {
      apiLogger.debug(
        log,
        'Item de cobrança sem conector — nada a provisionar e nada a cobrar',
      )

      return { outcome: 'no-connector', billingAdjusted: false }
    }

    if (!raw.subscriptionId) {
      this.refused(
        log,
        'missing-parent',
        'Item sem o campo parent da assinatura (parentId1142): sem pai não há ' +
          'contrato a cobrar, e linha não cobrável não é linha.',
      )

      return { outcome: 'refused', billingAdjusted: false }
    }

    // ── Passo 2: a assinatura pai. Traz `aplication` já hidratada, e é dela que
    // saem `domainId` e `appCode` — sem lookup reverso novo.
    const parent = await this.subscriptions.getSubscription(raw.subscriptionId)

    // ── Passo 3 e 4: o recurso e a credencial.
    if (action.kind === 'provision') {
      const provisioned = await this.provisionAndPersist({
        log,
        itemId: raw.id,
        provider: action.provider,
        customerName: parent.aplication.customer.name,
        subscriptionId: parent.id,
      })

      if (!provisioned) return { outcome: 'orphaned', billingAdjusted: false }
    }

    // ── Passo 5 e 6: cobrança do contrato e assinatura do recurso no provider.
    const billingAdjusted = await this.reconcileBilling({
      log,
      itemId: raw.id,
      parent,
      provider: action.provider,
    })

    return {
      outcome:
        action.kind === 'provision' ? 'provisioned' : 'already-provisioned',
      billingAdjusted,
    }
  }

  /**
   * Cria o recurso no provider e grava a credencial no item.
   *
   * Devolve `false` quando a gravação falhou — o recurso existe e não está vinculado a
   * nada. O fluxo **para** aí: reconciliar a cobrança de uma linha que a leitura de
   * domínio ainda recusa não é possível, e tentar cobraria pelo que não se consegue
   * contar.
   *
   * A falha de provisionamento (rede, provider fora) **sobe**: é o único passo em que
   * repetir ajuda e nada foi criado, então o retry do BullMQ é o comportamento certo.
   */
  private async provisionAndPersist(args: {
    log: Record<string, unknown>
    itemId: string
    provider: ConnectorProvider
    customerName: string
    /** `parentId1142` do item, para o espelho do recurso. */
    subscriptionId: string
  }): Promise<boolean> {
    const adapter = this.providerResolver.resolve(args.provider)

    let resource
    try {
      resource = await adapter.provisionConnector({
        name: `${args.customerName} | line-${randomUUID()}`,
      })
    } catch (error) {
      this.refused(
        args.log,
        'provision-failed',
        'O provider recusou ou não respondeu à criação do recurso. Nada foi criado lá.',
        error,
      )
      throw error
    }

    try {
      /**
       * A credencial é validada antes de gravar: `toLineMetadata` lança quando o provider
       * devolve recurso sem credencial, e um item com credencial pela metade nunca
       * conectaria. Fica **dentro** deste `try` porque o desfecho é o mesmo da gravação
       * falhando: o recurso já existe lá e não está vinculado a nada.
       */
      const metadata = toLineMetadata(args.provider, resource)

      /**
       * Só `metadata` — bloco atômico com provider e credencial juntos, e os campos do
       * outro provider zerados. `title`, `settings` e `vinculatedChannel` ficam de fora:
       * o operador digitou o título, e sobrescrevê-lo apagaria a identificação que ele
       * deu à linha.
       */
      await this.items.updateSubscriptionItem(args.itemId, { metadata })

      /**
       * O espelho vem logo depois, e a falha dele **não** derruba o provisionamento: linha
       * provisionada sem espelho é degradação recuperável pelo backfill, enquanto linha não
       * provisionada é cliente pagando pelo que não recebeu. Ver `saveMirror`.
       */
      await saveResourceMirror(this.mirrors, {
        itemId: args.itemId,
        provider: args.provider,
        resource,
        subscriptionId: args.subscriptionId,
        log: args.log,
      })

      return true
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.subscription.manual_line_credential_orphaned',
        {
          ...args.log,
          subscriptionItemId: args.itemId,
          provider: args.provider,
          orphanRemoteId: resourceRefOf(args.provider, resource),
          err: error,
        },
        {
          level: 'error',
          msg:
            'Recurso provisionado e a credencial não foi gravada no item — recurso órfão ' +
            'que nós pagamos, e o item segue ilegal para a leitura. Colar a credencial no ' +
            'item da SPA 1146, ou apagar o recurso no provider',
        },
      )

      return false
    }
  }

  /**
   * Leva os `line_items` do contrato do **pai** ao estado desejado.
   *
   * Devolve `false` quando não havia o que ajustar, e isso não é falha: contrato que não
   * é do gateway tem a cobrança mantida por automação fora do produto, e é ela que se
   * responsabiliza pela linha nova. Escrever no gateway a partir daqui inverteria a
   * direção do fluxo.
   */
  private async reconcileBilling(args: {
    log: Record<string, unknown>
    itemId: string
    parent: Subscription
    provider: ConnectorProvider
  }): Promise<boolean> {
    const { parent } = args

    if (parent.modality !== 'stripe') {
      apiLogger.info(
        { ...args.log, subscriptionId: parent.id, modality: parent.modality },
        'Assinatura fora do gateway — linha provisionada e a cobrança é da automação de fora',
      )

      return false
    }

    if (isTrialStatus(parent.status) || !parent.gatewayId) {
      apiLogger.info(
        { ...args.log, subscriptionId: parent.id, status: parent.status },
        'Assinatura sem contrato pago no gateway — linha provisionada e nada a ajustar',
      )

      return false
    }

    if (parent.status === 'cancelled') {
      /**
       * `warn`, e não `info`: a assinatura não existe mais no gateway, então não há
       * `line_item` a ajustar — mas provisionar recurso para um contrato que terminou é
       * estado que alguém precisa ver.
       */
      apiLogger.warn(
        { ...args.log, subscriptionId: parent.id },
        'Assinatura cancelada no gateway — linha provisionada e nenhuma cobrança ajustada',
      )

      return false
    }

    if (!this.gateway) {
      /**
       * Assinatura declara modalidade do gateway e o ambiente não tem chave dele. É
       * configuração incompleta nossa, não estado do cliente — e o recurso já foi
       * provisionado, então a linha existe e não está cobrada.
       */
      this.billingNotAdjusted(
        args,
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
       * Catálogo ambíguo ou incompleto é recusa, não escolha: escolher entre dois planos
       * do mesmo conector cobraria o preço de um pelo uso do outro, em silêncio. O
       * recurso provisionado permanece, e o log nomeia o ajuste pendente.
       */
      const reason =
        error instanceof PlanForProviderAmbiguousError
          ? 'plan-for-provider-ambiguous'
          : error instanceof PlanForProviderMissingError
            ? 'plan-for-provider-missing'
            : 'sync-failed'

      this.billingNotAdjusted(args, reason, error)

      return false
    }

    try {
      await this.gateway.syncSubscriptionLineItems({
        gatewaySubscriptionId: parent.gatewayId,
        lineItems,
      })
    } catch (error) {
      this.billingNotAdjusted(args, 'sync-failed', error)
      throw error
    }

    apiLogger.info(
      {
        ...args.log,
        subscriptionId: parent.id,
        gatewaySubscriptionId: parent.gatewayId,
        lineItems,
      },
      'Cobrança do contrato ajustada para a linha criada à mão',
    )

    /**
     * ── Passo 6: a cobrança do recurso com o **provider**, depois de a linha existir e
     * estar cobrada. `subscribe` nunca lança. Só a linha nova — reassinar as que já
     * estavam assinadas seria uma ida à rede por linha, sem efeito.
     *
     * Fora do caminho de trial de propósito: trial nunca assinou, e este ponto só é
     * alcançado por contrato que cobra.
     */
    const item = contract
      .flatMap(subscription => subscription.items)
      .find(candidate => candidate.id === args.itemId)

    if (item) {
      await this.providerBilling.subscribe(item)
    } else {
      apiLogger.warn(
        { ...args.log, subscriptionItemId: args.itemId },
        'Item não encontrado no contrato relido — recurso não assinado no provider',
      )
    }

    return true
  }

  /**
   * O contrato do **pai**: ele mais as irmãs que compartilham o mesmo `gatewayId`.
   *
   * Não usa `resolveCurrentContract`, que escolhe a assinatura vigente da instalação: o
   * item manual pode ter sido pendurado numa assinatura que não é a vigente, e cobrar o
   * contrato vigente por isso ajustaria a cobrança errada.
   *
   * A leitura vem de `GetAplicationContext` porque é ela que já traz as assinaturas
   * **com itens**, que é o que a contagem de linhas exige. E acontece **depois** da
   * escrita da credencial: antes dela, o item recém-criado faria o mapper recusar e a
   * leitura inteira lançaria.
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

    /**
     * O pai relido do contexto quando ele aparece lá, para os itens vierem da mesma
     * leitura das irmãs. Quando não aparece — instalação sem espelho na SPA 1060, ou
     * assinatura fora da listagem — entra sem itens: a contagem perde as linhas dele,
     * e é por isso que a ausência não é silenciosa.
     */
    if (!hydratedParent) {
      apiLogger.warn(
        { app: 'thinkzap', subscriptionId: parent.id },
        'Assinatura pai não apareceu na listagem da instalação — contagem de linhas incompleta',
      )

      return [{ ...parent, items: [] }, ...siblings]
    }

    return [hydratedParent, ...siblings]
  }

  private refused(
    log: Record<string, unknown>,
    reason: string,
    detail: string,
    error?: unknown,
  ): void {
    logThinkzapError(
      apiLogger,
      'thinkzap.subscription.manual_line_not_provisioned',
      { ...log, reason, detail, ...(error ? { err: error } : {}) },
      {
        level: 'error',
        msg: 'Item de assinatura criado à mão não virou linha — nenhum recurso foi criado',
      },
    )
  }

  private billingNotAdjusted(
    args: {
      log: Record<string, unknown>
      itemId: string
      parent: Subscription
    },
    reason: string,
    error: unknown,
  ): void {
    logThinkzapError(
      apiLogger,
      'thinkzap.subscription.manual_line_billing_not_adjusted',
      {
        ...args.log,
        subscriptionItemId: args.itemId,
        subscriptionId: args.parent.id,
        gatewaySubscriptionId: args.parent.gatewayId,
        reason,
        err: error,
      },
      {
        level: 'error',
        msg: 'Linha criada à mão e a cobrança do contrato não foi ajustada — cliente com uma linha a mais do que paga',
      },
    )
  }
}
