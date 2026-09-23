import type {
  SubscriptionItemMetadataView,
  SubscriptionItemView,
  SubscriptionView,
} from './aplication-context'

/**
 * Lista de conexões derivada dos itens das assinaturas de
 * `GET /api/application/me`.
 *
 * A lista **não** é mais montada a partir de conector/instância: a linha
 * contratada é o item da assinatura, e é ele que existe do ponto de vista do
 * cliente. Consequência aceita: status de conexão **ao vivo**, canal vinculado e
 * telefone não aparecem aqui — nada disso está no item, e ler o provider por linha
 * custaria uma chamada por conector a cada carregamento. O que aparece é o último
 * estado registrado no item (`connected`), gravado pelos eventos de conexão; a
 * leitura ao vivo continua na aba de conexão da linha.
 */

/** Provider da linha, como a UI rotula. */
export type LineProvider = 'ZAPI' | 'HUBMESSAGE' | 'NONE'

export type SubscriptionLine = {
  /** Id do item na SPA de itens de assinatura. */
  id: string
  name: string
  status: SubscriptionItemView['status']
  provider: LineProvider
  /** Id da assinatura que hospeda esta linha. */
  subscriptionId: string
  /**
   * Nome do plano que precifica o **conector desta linha**.
   *
   * Vem da composição do contrato, e não da assinatura pai: uma assinatura hospeda os
   * itens de vários conectores, e o plano dela descreve um só — usá-lo por linha diria
   * "WhatsApp Web" numa linha do WhatsApp Oficial, na mesma tela em que o cliente
   * confere o que paga.
   *
   * Vazio quando o conector não está na composição. A tela mostra o rótulo de "sem
   * plano": inventar um nome é pior que não ter.
   */
  planName: string
  /**
   * Identificador da linha no provider, quando existe. Não é credencial: o
   * mapper do api já redige o token da Z-API.
   */
  providerRef: string | null
  /**
   * Último estado de conexão registrado no item — espelho gravado pelos eventos
   * de conexão/desconexão, não leitura ao vivo. `null` = nunca registrado (linha
   * que ainda não conectou desde que o campo existe, ou item sem conector).
   * A aba de conexão da linha continua sendo a leitura autoritativa.
   */
  connected: boolean | null
}

/** O nome do plano de cada conector, como a composição do contrato o devolve. */
export type PlanNameByProvider = ReadonlyMap<LineProvider, string>

/**
 * Monta o índice `conector → nome do plano` a partir da composição que
 * `GET /thinkzap/subscription` devolve.
 *
 * Plano sem conector — o de trial — fica de fora: ele não precifica nenhum, e
 * indexá-lo por ausência rotularia qualquer linha com o nome do teste.
 */
export function planNamesByProvider(
  plans: readonly { provider?: LineProvider; name: string }[] | undefined,
): PlanNameByProvider {
  const byProvider = new Map<LineProvider, string>()

  for (const plan of plans ?? []) {
    if (!plan.provider) continue
    byProvider.set(plan.provider, plan.name)
  }

  return byProvider
}

const providerRef = (metadata: SubscriptionItemMetadataView): string | null => {
  switch (metadata.provider) {
    case 'ZAPI':
      return metadata.zApiInstanceId
    case 'HUBMESSAGE':
      return metadata.hubmessageChannelId
    case 'NONE':
      return null
  }
}

/**
 * Achata os itens das assinaturas numa lista de linhas.
 *
 * Assinatura cancelada não entra: os itens dela não são linhas do cliente, e
 * incluí-los divergiria da contagem de `connectorQuantity`. Item cancelado
 * dentro de assinatura viva **entra**, com o próprio status — esconder faria a
 * linha desaparecer da tela antes do fim do período pago.
 */
export function listSubscriptionLines(
  subscriptions: readonly SubscriptionView[] | undefined | null,
  planNames?: PlanNameByProvider,
): SubscriptionLine[] {
  if (!subscriptions) return []

  return subscriptions
    .filter(subscription => subscription.status !== 'cancelled')
    .flatMap(subscription =>
      subscription.items.map(item => ({
        id: item.id,
        name: item.name,
        status: item.status,
        provider: item.metadata.provider,
        subscriptionId: subscription.id,
        planName: planNames?.get(item.metadata.provider) ?? '',
        providerRef: providerRef(item.metadata),
        connected: item.connected ?? null,
      })),
    )
}

/** Linhas ativas — o que o cliente pode usar agora. */
export const countActiveLines = (lines: readonly SubscriptionLine[]): number =>
  lines.filter(line => line.status === 'active').length

/**
 * Habilitação da assinatura pai, derivada dela e do agora.
 *
 * Espelha `resolveLineEntitlement` do api (`thinkzap/domain/connector-trial.ts`),
 * de propósito: o payload de `/api/application/me` traz `status` e
 * `currentPeriodEnd`, que é tudo de que a decisão precisa, e expor `entitlement`
 * no contrato de leitura de contexto ampliaria o contrato por causa de um
 * consumidor. A duplicação é contida — o guard de envio no backend continua sendo
 * a autoridade, então divergir aqui não autoriza nada indevido.
 *
 * `trialing` vale enquanto `now <= currentPeriodEnd`: `>` e não `>=`, porque o
 * último instante da janela ainda é do cliente. Como a api ancora `currentPeriodEnd`
 * no **fim** do dia, isso dá ao cliente o último dia inteiro — a comparação não
 * mudou, a âncora mudou. `trial_expired` não consulta a
 * janela — é o teste encerrado por marcação no CRM, e um `currentPeriodEnd` no
 * futuro não o reabre. Status desconhecido não habilita — é decisão de
 * autorização, e um `default` permissivo faria linha inválida aparecer no widget.
 */
const isSubscriptionEnabled = (
  subscription: SubscriptionView,
  now: Date,
): boolean => {
  switch (subscription.status) {
    case 'active':
      return true
    case 'trialing':
      return now.getTime() <= new Date(subscription.currentPeriodEnd).getTime()
    case 'trial_expired':
    case 'cancelled':
    case 'past_due':
      return false
    default:
      return false
  }
}

/**
 * Linhas que o widget de conversa pode oferecer para envio.
 *
 * **Ofertável não é o mesmo que visível.** `listSubscriptionLines` existe para a
 * tela de conexões, que mostra de propósito linha bloqueada e item cancelado — o
 * cliente tem que ver o que tinha e por que parou. O widget existe para mandar
 * mensagem: oferecer uma linha que o envio vai recusar só gera erro na cara do
 * operador. São dois conjuntos diferentes, e uma função com flag serviria os dois
 * errado.
 *
 * Fora ficam: item de assinatura sem entitlement `active`, item `cancelled` e item
 * de cobrança sem conector (`provider: 'NONE'`, que não é linha).
 *
 * `now` entra por parâmetro em vez de `new Date()` aqui dentro: a função é pura, o
 * chamador decide o instante e o teste não precisa de relógio falso. Consequência
 * aceita: a lista não se atualiza sozinha quando o trial vence com a aba aberta —
 * o próximo render corrige, e o envio já era recusado pelo backend nesse meio.
 *
 * Ver spec `widget-line-listing`.
 */
export function listSendableLines(
  subscriptions: readonly SubscriptionView[] | undefined | null,
  now: Date,
  planNames?: PlanNameByProvider,
): SubscriptionLine[] {
  if (!subscriptions) return []

  return subscriptions
    .filter(subscription => isSubscriptionEnabled(subscription, now))
    .flatMap(subscription =>
      subscription.items
        .filter(
          item => item.status === 'active' && item.metadata.provider !== 'NONE',
        )
        .map(item => ({
          id: item.id,
          name: item.name,
          status: item.status,
          provider: item.metadata.provider,
          subscriptionId: subscription.id,
          planName: planNames?.get(item.metadata.provider) ?? '',
          providerRef: providerRef(item.metadata),
          connected: item.connected ?? null,
        })),
    )
}
