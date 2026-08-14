import { randomUUID } from 'node:crypto'

import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { Plan, PlanProvider } from '@/modules/application/domain/entities/plan'
import { Subscription } from '@/modules/application/domain/entities/subscription'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { SpaItemResourceMirrorRepository } from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { ensureSubscriptionModalityField } from '@/modules/application/infra/bitrix/ensure-subscription-modality-field'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { resolveCurrentContract } from '@/modules/thinkzap/domain/line-subscription'
import { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import { CheckoutIntent } from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import { apiLogger } from '@/shared/infra/logger'
import { thinkzapError, logThinkzapError } from '../errors/catalog'
import { lineNameFor, toLineMetadata } from './helpers/line-resource-metadata'
import { saveResourceMirror } from './helpers/save-resource-mirror'
import { resolvePlanForProvider } from '@/modules/thinkzap/domain/line-subscription'
import { ListOfferablePlans } from './list-offerable-plans'
import { ProviderResourceBilling } from './provider-resource-billing'

export type ActivateLineSubscriptionInput = {
  /** Uuid de `core_domains`, como vem no metadata do checkout. */
  domainId: string
  /** `core_app_codes.id`, como vem no metadata do checkout. */
  appCode: string
  /** Id do item de plano na SPA de planos. */
  planId: string
  /** Id da assinatura no gateway. Chave de idempotência da ativação. */
  gatewaySubscriptionId: string
  /**
   * O que a contratação queria. `convert` cobra o que já existe; `add-line` cobra o
   * que já existe **mais** uma linha nova, que nasce aqui.
   */
  intent: CheckoutIntent
  currentPeriodStart: Date
  currentPeriodEnd: Date
}

export type ActivateLineSubscriptionOutput = {
  subscriptionId: string
  /** `true` quando a reentrega encontrou a assinatura já criada. */
  alreadyActive: boolean
}

export class AplicationWithoutSpaMirrorError extends Error {
  constructor(appCode: string) {
    super(
      `Instalação "${appCode}" não tem espelho na SPA de aplicações: sem ele não há ` +
        'parent onde pendurar a assinatura paga.',
    )
    this.name = 'AplicationWithoutSpaMirrorError'
  }
}

/**
 * Ativa a assinatura paga de uma instalação, em passos **nesta ordem**:
 *
 * ```
 * 1. cria uma Subscription por plano envolvido (active, gatewayId compartilhado)
 * 2. move cada item para a irmã do plano que precifica o conector dele
 *                                  ← se falhar aqui, cliente pagou e linha morta
 * 3. cria o item da linha nova, quando a intenção é acrescentar
 * 4. encerra a de trial (cancelled)
 * 5. subscribe no provider de CADA linha cobrada
 * ```
 *
 * **A ordem é obrigatória e não é preferência** (decisão 1 do design de
 * `add-line-subscription`). Encerrar o trial antes de mover deixaria o item
 * apontando para assinatura cancelada, e a linha ficaria bloqueada **mesmo com
 * pagamento aprovado**. Mover antes de criar é impossível.
 *
 * Se o passo 2 falhar, os seguintes **não** rodam: o item continua no trial vencido,
 * o cliente continua bloqueado, e o log nomeia as duas assinaturas e o item para
 * reconciliação manual. É o estado ruim menos pior — errado e visível, em vez de
 * errado e silencioso. Não há compensação automática: desfazer cobrança aprovada é
 * pior que um chamado.
 *
 * **Uma assinatura por plano na SPA, todas com o mesmo `gatewayId`.** No gateway
 * continua sendo uma assinatura, com um `line_item` por preço. Na SPA cada registro
 * descreve honestamente a cobrança do grupo de linhas dele — plano parcial faria a
 * tela mostrar o preço de um conector para a linha do outro. Contratação de um plano
 * só cria uma assinatura só: a forma anterior é o caso degenerado desta.
 *
 * O `subscribe` no provider vem **depois** de todas as escritas, e não bloqueia o
 * resultado.
 */
export class ActivateLineSubscription {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly subscriptions: SubscriptionRepository,
    private readonly items: SubscriptionItemRepository,
    private readonly providerBilling: ProviderResourceBilling,
    private readonly bitrix: BitrixClient,
    private readonly plans: ListOfferablePlans,
    private readonly providerResolver: ConnectorProviderResolver,
    /** Espelho do recurso — a cópia da credencial que sobrevive ao item apagado. */
    private readonly mirrors: SpaItemResourceMirrorRepository,
  ) {}

  async execute(
    input: ActivateLineSubscriptionInput,
  ): Promise<ActivateLineSubscriptionOutput> {
    /**
     * Idempotência **antes** de qualquer escrita: o gateway reentrega por design, e
     * uma segunda entrega do mesmo `checkout.session.completed` não pode criar
     * outra assinatura, mover o item de novo, criar a linha de novo, nem reassinar o
     * recurso.
     *
     * Lista **não vazia** é o sinal, e não "encontrou uma": uma ativação de dois
     * planos deixa duas irmãs com o mesmo id, e qualquer uma delas prova que já
     * rodou.
     */
    const existing = await this.subscriptions.listSubscriptionsByGatewayId(
      input.gatewaySubscriptionId,
    )

    if (existing.length > 0) {
      apiLogger.info(
        {
          app: 'thinkzap',
          gatewaySubscriptionId: input.gatewaySubscriptionId,
          subscriptionIds: existing.map(subscription => subscription.id),
        },
        'Ativação já processada para este id de gateway — reentrega ignorada',
      )
      return { subscriptionId: existing[0]!.id, alreadyActive: true }
    }

    /**
     * O campo de modalidade **antes** da primeira escrita: `crm.item.update` aceita
     * campo desconhecido e responde sucesso, descartando o valor. Sem esta
     * verificação a assinatura nasceria lendo `manual`, e o cliente perderia o
     * portal de faturamento — sem erro, sem log, sem rastro.
     */
    await ensureSubscriptionModalityField(this.bitrix)

    const context = await this.getAplicationContext.execute({
      domainId: input.domainId,
      appCode: input.appCode,
    })

    if (!context.aplication.spaId) {
      throw new AplicationWithoutSpaMirrorError(input.appCode)
    }

    /**
     * O contrato de origem é o vigente: normalmente o trial, em andamento ou
     * vencido. Contratar com o trial ainda dentro da janela é permitido — a janela
     * paga começa agora, sem crédito pelos dias não usados.
     */
    const origin = resolveCurrentContract(context.subscriptions)
    const lines = this.linesOf(origin)

    /**
     * O plano de cada conector, resolvido pela **mesma** regra que montou a cobrança
     * no checkout. Regras separadas divergiriam, e a divergência apareceria como
     * linha pendurada no plano errado — com o preço errado na tela.
     */
    const offerable = await this.plans.listOfferable()
    const newLineProvider =
      input.intent.kind === 'add-line' ? input.intent.provider : null

    const providers = new Set<PlanProvider>(
      lines.map(line => line.metadata.provider as PlanProvider),
    )
    if (newLineProvider) providers.add(newLineProvider)

    const planByProvider = this.resolvePlans(
      providers,
      offerable,
      newLineProvider
        ? { provider: newLineProvider, planId: input.planId }
        : null,
    )

    // ── Passo 1: uma assinatura por plano, todas com o mesmo id no gateway.
    const subscriptionByPlan = await this.createSiblings({
      planByProvider,
      aplicationSpaId: context.aplication.spaId,
      aplicationTitle: context.aplication.title,
      input,
    })

    const primary = subscriptionByPlan.values().next().value as Subscription

    // ── Passo 2: cada linha passa a ser paga pela irmã do plano dela.
    const moved: SubscriptionItem[] = []
    for (const line of lines) {
      const plan = planByProvider.get(line.metadata.provider as PlanProvider)!
      const parent = subscriptionByPlan.get(plan.id)!

      try {
        moved.push(
          await this.items.reparentSubscriptionItem(line.id, parent.id),
        )
      } catch (error) {
        /**
         * O risco concentrado: cliente pagou e a linha continua morta. Os passos
         * seguintes **não** rodam — encerrar o trial agora tiraria o único pai que
         * ainda podia destravar a linha, se ele estivesse dentro da janela.
         *
         * As duas assinaturas e o item são nomeados no log porque a recuperação é
         * mover o item à mão no CRM, e sem os três ids ninguém sabe qual mover para
         * onde.
         */
        logThinkzapError(
          apiLogger,
          'thinkzap.subscription.line_blocked_after_payment',
          {
            app: 'thinkzap',
            domainId: input.domainId,
            appCode: input.appCode,
            subscriptionItemId: line.id,
            originSubscriptionId: line.subscription,
            paidSubscriptionId: parent.id,
            gatewaySubscriptionId: input.gatewaySubscriptionId,
            err: error,
          },
          {
            level: 'error',
            msg: 'Pagamento aprovado e o item não foi movido para a assinatura paga — linha bloqueada, mover o item à mão no CRM',
          },
        )
        throw error
      }
    }

    if (lines.length === 0) {
      /**
       * Instalação sem linha: pagou antes de ativar o teste, e a intenção não era
       * acrescentar. A assinatura paga existe e é válida; criar linha aqui seria
       * provisionar sem ninguém ter pedido.
       */
      apiLogger.warn(
        {
          app: 'thinkzap',
          domainId: input.domainId,
          paidSubscriptionId: primary.id,
        },
        'Assinatura paga criada numa instalação sem linha — nada a mover',
      )
    }

    // ── Passo 3: a linha nova, quando foi ela que motivou a contratação.
    const created = newLineProvider
      ? await this.createNewLine({
          provider: newLineProvider,
          plan: planByProvider.get(newLineProvider)!,
          subscriptionByPlan,
          lineOrder: lines.length + 1,
          customerName: context.customer.name,
          input,
        })
      : null

    // ── Passo 4: o trial sai de cena. Falhar aqui não desfaz nada.
    await this.endOrigin(origin, subscriptionByPlan)

    /**
     * ── Passo 5: `subscribe` **depois** das escritas na SPA, e sem poder derrubá-las.
     * O inverso trocaria o custo do erro: uma falha do provider passaria a impedir a
     * ativação de quem já pagou.
     *
     * **Cada** linha cobrada, não só a nova nem só a movida: o recurso do trial nunca
     * foi assinado no provider (é o que impede 3 dias de teste de virar instância
     * cobrada por mês), então converter sem assiná-lo deixaria o recurso rodando
     * fora do nosso contrato com o provider — invisível até o provider cortar.
     */
    for (const item of [...moved, ...(created ? [created] : [])]) {
      await this.providerBilling.subscribe(item)
    }

    return { subscriptionId: primary.id, alreadyActive: false }
  }

  /**
   * O plano de cada conector envolvido.
   *
   * O plano escolhido no checkout (`input.planId`) tem precedência para o conector
   * que ele precifica: é o único que o cliente escolheu, e ele já passou pelo
   * predicado de ofertável antes de a sessão existir. Os demais conectores são
   * resolvidos pelo catálogo.
   *
   * Plano ausente ou ambíguo aqui é falha de verdade, e **não** tem recuperação
   * automática: o pagamento já foi aprovado. As duas condições são validadas antes
   * de criar a sessão, justamente para não chegarem até aqui.
   */
  private resolvePlans(
    providers: Set<PlanProvider>,
    offerable: Plan[],
    chosen: { provider: PlanProvider; planId: string } | null,
  ): Map<PlanProvider, Plan> {
    const byProvider = new Map<PlanProvider, Plan>()

    for (const provider of providers) {
      /**
       * O conector da linha nova usa o plano **escolhido**, e não a resolução por
       * catálogo: é o único plano que o cliente escolheu, e ele já passou pelo
       * predicado de ofertável antes de a sessão existir. É também o que permite
       * criar linha num conector que tem mais de um plano — a ambiguidade só é
       * bloqueante para linha que já existe, porque ali não há escolha registrada.
       */
      if (chosen?.provider === provider) {
        const plan = offerable.find(item => item.id === chosen.planId)
        if (plan) {
          byProvider.set(provider, plan)
          continue
        }
      }

      const resolved = resolvePlanForProvider(offerable, provider)

      if (resolved.kind !== 'resolved') {
        throw thinkzapError(
          'thinkzap.subscription.activation_failed',
          new Error(
            `Não há um plano ofertável único para o conector ${provider} ` +
              `(${resolved.kind}) — pagamento aprovado e a assinatura não pode ser montada`,
          ),
        )
      }

      byProvider.set(provider, resolved.plan)
    }

    return byProvider
  }

  /** Uma assinatura por plano, todas com o mesmo id no gateway. */
  private async createSiblings(args: {
    planByProvider: Map<PlanProvider, Plan>
    aplicationSpaId: string
    aplicationTitle: string
    input: ActivateLineSubscriptionInput
  }): Promise<Map<string, Subscription>> {
    const byPlan = new Map<string, Subscription>()

    for (const plan of args.planByProvider.values()) {
      if (byPlan.has(plan.id)) continue

      byPlan.set(
        plan.id,
        await this.subscriptions.createSubscription({
          name: `${plan.name} — ${args.aplicationTitle}`,
          planId: plan.id,
          aplicationSpaId: args.aplicationSpaId,
          status: 'active',
          currentPeriodStart: args.input.currentPeriodStart,
          currentPeriodEnd: args.input.currentPeriodEnd,
          gatewayId: args.input.gatewaySubscriptionId,
          modality: 'stripe',
        }),
      )
    }

    /**
     * Instalação sem linha e sem plano resolvido: a assinatura do plano escolhido
     * nasce de qualquer forma, porque o pagamento existe e precisa de espelho.
     */
    if (byPlan.size === 0) {
      byPlan.set(
        args.input.planId,
        await this.subscriptions.createSubscription({
          name: `Assinatura — ${args.aplicationTitle}`,
          planId: args.input.planId,
          aplicationSpaId: args.aplicationSpaId,
          status: 'active',
          currentPeriodStart: args.input.currentPeriodStart,
          currentPeriodEnd: args.input.currentPeriodEnd,
          gatewayId: args.input.gatewaySubscriptionId,
          modality: 'stripe',
        }),
      )
    }

    return byPlan
  }

  /**
   * Provisiona e cria a linha nova.
   *
   * **Não lança.** As linhas que já existiam foram movidas e já funcionam pela
   * assinatura paga; propagar faria o gateway reentregar o evento, e a reentrega
   * bate na idempotência e não chega até aqui — ou seja, o retry não recuperaria
   * nada e o cliente perderia o que já foi ativado. O log carrega o que a criação
   * manual exige.
   */
  private async createNewLine(args: {
    provider: PlanProvider
    plan: Plan
    subscriptionByPlan: Map<string, Subscription>
    lineOrder: number
    customerName: string
    input: ActivateLineSubscriptionInput
  }): Promise<SubscriptionItem | null> {
    const provider =
      args.provider === 'HUBMESSAGE'
        ? ConnectorProvider.HUBMESSAGE
        : ConnectorProvider.ZAPI

    try {
      const adapter = this.providerResolver.resolve(provider)
      const resource = await adapter.provisionConnector({
        name: `${args.customerName} | line-${randomUUID()}`,
      })

      const metadata = toLineMetadata(provider, resource)
      const parent = args.subscriptionByPlan.get(args.plan.id)!

      const item = await this.items.createSubscriptionItem({
        name: lineNameFor(provider, args.lineOrder),
        subscription: parent.id,
        status: 'active',
        metadata,
      })

      await saveResourceMirror(this.mirrors, {
        itemId: item.id,
        provider,
        resource,
        subscriptionId: parent.id,
      })

      return item
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.subscription.new_line_not_created',
        {
          app: 'thinkzap',
          domainId: args.input.domainId,
          appCode: args.input.appCode,
          gatewaySubscriptionId: args.input.gatewaySubscriptionId,
          planId: args.plan.id,
          provider: args.provider,
          err: error,
        },
        {
          level: 'error',
          msg: 'Pagamento aprovado e a linha nova não foi criada — as linhas que já existiam seguem funcionando; criar o item à mão no CRM',
        },
      )
      return null
    }
  }

  /**
   * Encerra as assinaturas de origem que não fazem parte do contrato novo.
   *
   * Só o status. Período, plano e itens ficam como estão — os itens já foram
   * movidos, e reescrevê-los aqui é a chance de apagar a linha de quem acabou de
   * pagar.
   */
  private async endOrigin(
    origin: readonly Subscription[],
    subscriptionByPlan: Map<string, Subscription>,
  ): Promise<void> {
    const created = new Set(
      [...subscriptionByPlan.values()].map(subscription => subscription.id),
    )

    for (const subscription of origin) {
      if (created.has(subscription.id)) continue
      if (subscription.status === 'cancelled') continue

      try {
        await this.subscriptions.updateSubscription(subscription.id, {
          status: 'cancelled',
        })
      } catch (error) {
        /**
         * `warn`, não `error`: a linha **já funciona**, porque o item aponta para a
         * assinatura ativa. Uma assinatura de trial sobrando não destrava nada por
         * conta própria — a janela dela já passou —, então não há urgência.
         */
        apiLogger.warn(
          {
            app: 'thinkzap',
            originSubscriptionId: subscription.id,
            err: error,
          },
          'Assinatura de origem não foi encerrada — a linha já funciona pela paga',
        )
      }
    }
  }

  /** As linhas do contrato: item ativo com conector. Item de cobrança não é linha. */
  private linesOf(
    contract: readonly { items: SubscriptionItem[] }[],
  ): SubscriptionItem[] {
    return contract.flatMap(subscription =>
      subscription.items.filter(
        item => item.status === 'active' && item.metadata.provider !== 'NONE',
      ),
    )
  }
}
