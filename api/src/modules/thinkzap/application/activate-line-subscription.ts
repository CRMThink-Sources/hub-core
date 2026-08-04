import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { ensureSubscriptionModalityField } from '@/modules/application/infra/bitrix/ensure-subscription-modality-field'
import { resolveCurrentSubscription } from '@/modules/thinkzap/domain/line-subscription'
import { apiLogger } from '@/shared/infra/logger'
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
 * Ativa a assinatura paga de uma instalação, em **três passos, nesta ordem**:
 *
 * ```
 * 1. cria Subscription nova (active, plano pago, gatewayId do gateway)
 * 2. move o item para ela          ← se falhar aqui, cliente pagou e linha morta
 * 3. encerra a de trial (cancelled)
 * ```
 *
 * **A ordem é obrigatória e não é preferência** (decisão 1 do design). Encerrar o
 * trial antes de mover deixaria o item apontando para assinatura cancelada, e a
 * linha ficaria bloqueada **mesmo com pagamento aprovado**. Mover antes de criar é
 * impossível.
 *
 * Se o passo 2 falhar, o passo 3 **não** roda: o item continua no trial vencido, o
 * cliente continua bloqueado, e o log nomeia as duas assinaturas e o item para
 * reconciliação manual. É o estado ruim menos pior — errado e visível, em vez de
 * errado e silencioso. Não há compensação automática: desfazer cobrança aprovada é
 * pior que um chamado.
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
  ) {}

  async execute(
    input: ActivateLineSubscriptionInput,
  ): Promise<ActivateLineSubscriptionOutput> {
    /**
     * Idempotência **antes** de qualquer escrita: o gateway reentrega por design, e
     * uma segunda entrega do mesmo `checkout.session.completed` não pode criar
     * outra assinatura, mover o item de novo, nem reassinar o recurso.
     */
    const existing = await this.subscriptions.getSubscriptionByGatewayId(
      input.gatewaySubscriptionId,
    )

    if (existing) {
      apiLogger.info(
        {
          app: 'thinkzap',
          gatewaySubscriptionId: input.gatewaySubscriptionId,
          subscriptionId: existing.id,
        },
        'Ativação já processada para este id de gateway — reentrega ignorada',
      )
      return { subscriptionId: existing.id, alreadyActive: true }
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
     * A assinatura de origem é a vigente: normalmente o trial, em andamento ou
     * vencido. Contratar com o trial ainda dentro da janela é permitido — a janela
     * paga começa agora, sem crédito pelos dias não usados.
     */
    const origin = resolveCurrentSubscription(context.subscriptions)
    const item = origin?.items[0] ?? null

    // ── Passo 1: a assinatura paga nasce limpa.
    const paid = await this.subscriptions.createSubscription({
      name: `Assinatura — ${context.aplication.title}`,
      planId: input.planId,
      aplicationSpaId: context.aplication.spaId,
      status: 'active',
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
      gatewayId: input.gatewaySubscriptionId,
      modality: 'stripe',
    })

    // ── Passo 2: a linha passa a ser paga pela assinatura nova.
    let moved: SubscriptionItem | null = null
    if (item) {
      try {
        moved = await this.items.reparentSubscriptionItem(item.id, paid.id)
      } catch (error) {
        /**
         * O risco concentrado desta change: cliente pagou e a linha continua
         * morta. O passo 3 **não** roda — encerrar o trial agora tiraria o único
         * pai que ainda podia destravar a linha, se ele estivesse dentro da janela.
         *
         * As duas assinaturas e o item são nomeados no log porque a recuperação é
         * mover o item à mão no CRM, e sem os três ids ninguém sabe qual mover para
         * onde.
         */
        apiLogger.error(
          {
            app: 'thinkzap',
            domainId: input.domainId,
            appCode: input.appCode,
            subscriptionItemId: item.id,
            originSubscriptionId: origin?.id,
            paidSubscriptionId: paid.id,
            gatewaySubscriptionId: input.gatewaySubscriptionId,
            err: error,
          },
          'Pagamento aprovado e o item não foi movido para a assinatura paga — linha bloqueada, mover o item à mão no CRM',
        )
        throw error
      }
    } else {
      /**
       * Instalação sem linha: pagou antes de ativar o teste. A assinatura paga
       * existe e é válida; criar linha aqui está fora de escopo (é provisionamento
       * sob demanda, com limite por assinatura a decidir).
       */
      apiLogger.warn(
        {
          app: 'thinkzap',
          domainId: input.domainId,
          paidSubscriptionId: paid.id,
        },
        'Assinatura paga criada numa instalação sem linha — nada a mover',
      )
    }

    // ── Passo 3: o trial sai de cena. Falhar aqui não desfaz nada.
    if (origin && origin.id !== paid.id && origin.status !== 'cancelled') {
      try {
        /**
         * Só o status. Período, plano e itens ficam como estão — os itens já foram
         * movidos, e reescrevê-los aqui é a chance de apagar a linha de quem acabou
         * de pagar.
         */
        await this.subscriptions.updateSubscription(origin.id, {
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
            originSubscriptionId: origin.id,
            paidSubscriptionId: paid.id,
            err: error,
          },
          'Assinatura de origem não foi encerrada — a linha já funciona pela paga',
        )
      }
    }

    /**
     * `subscribe` **depois** das escritas na SPA, e sem poder derrubá-las. O
     * inverso trocaria o custo do erro: uma falha do provider passaria a impedir a
     * ativação de quem já pagou.
     */
    if (moved) {
      await this.providerBilling.subscribe(moved)
    }

    return { subscriptionId: paid.id, alreadyActive: false }
  }
}
