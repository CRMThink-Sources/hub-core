import { GatewaySubscription } from '@/modules/application/domain/entities/gateway-subscription'
import { Subscription } from '@/modules/application/domain/entities/subscription'
import { PlanPrice } from '@/modules/thinkzap/domain/plan-pricing'

/**
 * Contrato neutro com o gateway de pagamento.
 *
 * Existe para que o caso de uso do webhook não conheça tipos do gateway: ele
 * recebe eventos já **normalizados**, com os campos que a SPA precisa e nada
 * mais. Sem isso, a decisão de negócio ("pagou → ativa") ficaria escrita em cima
 * do shape de um terceiro, e cada mudança de versão de API deles viraria mudança
 * no caso de uso.
 *
 * As implementações vivem em `infra` e NÃO devem vazar tipos do gateway.
 */

/** A instalação que um checkout pertence, carregada no metadata da sessão. */
export type GatewayInstallationRef = {
  /** Uuid de `core_domains`, como vem no JWT. */
  domainId: string
  /** `core_app_codes.id`, como vem no JWT. */
  appCode: string
  /** Id do item de plano na SPA de planos. */
  planId: string
}

/**
 * O que a contratação **quer**, carregado no metadata da sessão.
 *
 * `convert`: cobrar as linhas que já existem. É o caminho de `add-line-subscription`
 * — a ativação move os itens para a assinatura paga e encerra o trial.
 *
 * `add-line`: cobrar as linhas que já existem **mais uma nova**. A ativação faz o
 * mesmo do `convert` e, além disso, provisiona e cria o item da linha nova. Sem
 * distinguir os dois, uma contratação que acrescenta linha cobraria duas e
 * entregaria uma.
 */
export type CheckoutIntent =
  | { kind: 'convert' }
  | {
      kind: 'add-line'
      /** Conector da linha nova. */
      provider: 'ZAPI' | 'HUBMESSAGE'
      /** Plano que precifica a linha nova, na SPA de planos. */
      planId: string
    }

/** Um preço do contrato e quantas linhas ele cobra. */
export type GatewayLineItem = {
  /** Price id do gateway — o `gatewayId` do plano. */
  priceId: string
  /** Número de linhas daquele plano. Derivado da SPA, nunca do corpo. */
  quantity: number
}

/**
 * Evento do gateway, normalizado.
 *
 * Três tipos tratados, e só três (decisão 5 do design). Qualquer outro chega como
 * `ignored` — o gateway manda dezenas de tipos, e tratar evento desconhecido como
 * erro faria o gateway reentregar em backoff por algo que não nos diz nada.
 */
export type GatewayEvent =
  /** Pagamento concluído: é o que ativa a assinatura paga. */
  | {
      type: 'checkout.completed'
      /** Id da assinatura no gateway — a chave de idempotência de tudo. */
      gatewaySubscriptionId: string
      installation: GatewayInstallationRef
      /** O que a contratação queria. `convert` quando a sessão não declarou. */
      intent: CheckoutIntent
      currentPeriodStart: Date
      currentPeriodEnd: Date
    }
  /** Reflete pagamento recusado e recuperação. */
  | {
      type: 'subscription.updated'
      gatewaySubscriptionId: string
      status: Subscription['status']
      currentPeriodStart: Date
      currentPeriodEnd: Date
      /**
       * Soma das quantidades dos `line_items` no gateway.
       *
       * Não provisiona nem cancela nada — a SPA é a fonte de verdade do que existe,
       * e criar ou apagar linha a partir de um número vindo do gateway apagaria a
       * linha que o cliente usa. Serve para **registrar divergência**: quantidade
       * editada pelo portal de faturamento é o caminho pelo qual os dois lados se
       * separam, e sem isso ninguém nota.
       */
      totalLineQuantity: number
    }
  /** Cancelamento definitivo. */
  | { type: 'subscription.deleted'; gatewaySubscriptionId: string }
  /** Fora dos três: registrado e ignorado, com sucesso na resposta. */
  | { type: 'ignored'; name: string }

export type CreateCheckoutSessionInput = {
  /**
   * Um item por plano a cobrar. Mais de um quando a instalação tem linhas de
   * conectores diferentes: uma assinatura no gateway carrega um `line_item` por
   * preço, e é isso que torna providers misturados precificáveis.
   */
  lineItems: GatewayLineItem[]
  installation: GatewayInstallationRef
  /**
   * O que a contratação quer. Ausente é lido como `convert` na normalização do
   * evento, para sessão criada por deploy anterior continuar ativando.
   */
  intent: CheckoutIntent
}

/**
 * Ajuste dos `line_items` de uma assinatura que **já existe** no gateway.
 *
 * `lineItems` é o **estado desejado**, não um delta: o chamador manda a quantidade
 * final de cada preço, derivada da contagem de linhas na SPA. Estado desejado é
 * idempotente — a mesma chamada repetida não muda nada, enquanto um incremento
 * repetido cobra duas vezes.
 *
 * Preço ausente da lista **não é removido**: reduzir cobrança é cancelar linha, que
 * é operação própria e não efeito colateral de acrescentar outra.
 */
export type SyncSubscriptionLineItemsInput = {
  gatewaySubscriptionId: string
  lineItems: GatewayLineItem[]
}

/**
 * Sessão de checkout **embedada**.
 *
 * `clientSecret` e não `url`: o app roda dentro do iframe do Bitrix, e a página
 * hospedada do gateway não funciona emoldurada — em contexto de terceiro o
 * navegador particiona o storage que ela precisa, e a tela trava nos placeholders
 * sem nunca montar o formulário. O modo embedado é o caminho suportado para esse
 * cenário: o segredo é montado pelo SDK na nossa própria tela.
 *
 * Sem URL de retorno: a sessão é criada com redirecionamento desligado, e o SDK
 * avisa a conclusão por callback. Assim nada navega — nem o iframe do Bitrix, nem o
 * frame do gateway dentro dele.
 */
export type CheckoutSession = {
  clientSecret: string
}

export type CreateBillingPortalSessionInput = {
  /** Id do cliente no gateway, resolvido no servidor a partir da assinatura. */
  gatewaySubscriptionId: string
  returnUrl: string
}

export class GatewaySignatureError extends Error {
  constructor(detail: string) {
    super(`Assinatura do evento do gateway inválida: ${detail}`)
    this.name = 'GatewaySignatureError'
  }
}

export class GatewayPriceUnreadableError extends Error {
  constructor(
    readonly priceId: string,
    detail: string,
  ) {
    super(
      `Não foi possível ler o preço "${priceId}" no gateway: ${detail}. O plano fica ` +
        'sem preço resolvido e, por isso, fora dos ofertáveis — exibir um valor ' +
        'estimado apareceria na fatura do cliente.',
    )
    this.name = 'GatewayPriceUnreadableError'
  }
}

export class GatewaySubscriptionUnreadableError extends Error {
  constructor(
    readonly gatewaySubscriptionId: string,
    detail: string,
  ) {
    super(
      `Não foi possível ler a assinatura "${gatewaySubscriptionId}" no gateway: ` +
        `${detail}. O contrato fica sem dados de cobrança e a tela mostra só o ` +
        'período vigente — preencher a lacuna com valor de cadastro anunciaria um ' +
        'número que não bate com a fatura.',
    )
    this.name = 'GatewaySubscriptionUnreadableError'
  }
}

export interface PaymentGateway {
  /**
   * Valida a assinatura do evento sobre o corpo **cru** e devolve o evento
   * normalizado.
   *
   * Recebe `Buffer`, não objeto: a validação é um HMAC sobre os bytes exatos que
   * chegaram. Depois de `express.json()` o corpo foi reserializado e a assinatura
   * **sempre** falha.
   *
   * Lança `GatewaySignatureError` quando não confere — e não processa nada.
   */
  verifyWebhookEvent(
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<GatewayEvent>

  /** Cria a sessão de checkout embedada e devolve o segredo que o SDK monta. */
  createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CheckoutSession>

  /**
   * Leva os `line_items` de uma assinatura existente ao estado desejado.
   *
   * É o caminho da linha criada por quem **já paga**: o meio de pagamento está em
   * arquivo, então não há checkout — o gateway cobra a diferença proporcional pelo
   * comportamento default dele. Pedir cartão de novo a quem já autorizou cobrança
   * recorrente seria atrito puro.
   */
  syncSubscriptionLineItems(
    input: SyncSubscriptionLineItemsInput,
  ): Promise<void>

  /**
   * Cria a sessão do portal de faturamento e devolve a URL.
   *
   * URL, e não segredo embedável: o portal do gateway **não** tem modo embedado —
   * é página hospedada, e continua abrindo em aba própria.
   */
  createBillingPortalSession(
    input: CreateBillingPortalSessionInput,
  ): Promise<{ url: string }>

  /**
   * Lê o preço de um price, na forma que o domínio entende.
   *
   * Existe porque o preço dos conectores é **escalonado** e o gateway é a única
   * fonte dele: a SPA de planos guarda um valor de cadastro que não descreve
   * cobrança escalonada. Sem esta leitura, exibir preço é adivinhar.
   *
   * Devolve `PlanPrice`, nunca o tipo do gateway: `billing_scheme` e `tiers_mode`
   * são vocabulário do provedor, e deixá-los subir faria trocar de gateway
   * reescrever a regra de preço.
   *
   * Lança `GatewayPriceUnreadableError` quando o price não existe, quando a
   * chamada falha, ou quando o price é escalonado e os degraus não vieram — o
   * último caso é o mais traiçoeiro, porque um escalonado sem degraus se parece
   * com "plano sem preço" e passaria por gratuito.
   */
  readPrice(priceId: string): Promise<PlanPrice>

  /**
   * Lê a assinatura de um contrato, na forma que o domínio entende.
   *
   * Existe porque a `quantity` de cada `line_item` é a **única** fonte de quantas
   * linhas o gateway cobra, e ela diverge da contagem da SPA por construção: linha
   * de cortesia existe na SPA e não no `line_item`. Sem esta leitura, "bonificado"
   * é indistinguível de "cobrado".
   *
   * Devolve `GatewaySubscription`, nunca o tipo do gateway: os status extras do
   * provedor (`incomplete`, `unpaid`, `paused`) normalizam para `unknown` em vez de
   * serem forçados num dos quatro da SPA.
   *
   * Lança `GatewaySubscriptionUnreadableError` quando a assinatura não existe lá ou
   * a chamada falha.
   */
  readSubscription(gatewaySubscriptionId: string): Promise<GatewaySubscription>

  /**
   * Marca a assinatura para encerrar **no fim do período vigente**.
   *
   * É o caminho de quando não sobrou linha nenhuma no contrato. A reconciliação de
   * quantidade não cobre esse caso: ela deriva os `line_items` dos itens vivos, e
   * sem item vivo a lista sai vazia — o que não remove nada, porque
   * `syncSubscriptionLineItems` não remove preço ausente da lista.
   *
   * **Método próprio, e não lista vazia naquele.** Fazer lista vazia significar
   * "cancele tudo" transformaria a operação mais repetida do módulo numa que apaga
   * contrato quando alguém erra a construção da lista. Um método com nome próprio
   * não é chamado por engano.
   *
   * **Fim do período, não imediato.** O cliente pagou o período corrente: cortar na
   * hora sem devolver cobra por serviço não prestado, e devolver exigiria uma
   * política de crédito proporcional que o produto não tem. Encerrar no vencimento é
   * o único caminho que não pede essa decisão, e é reversível pelo painel até lá.
   *
   * Idempotente: repetir sobre contrato já marcado não muda nada.
   */
  cancelSubscriptionAtPeriodEnd(gatewaySubscriptionId: string): Promise<void>
}
