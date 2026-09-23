/**
 * A parte **pura** de `sync-hubmessage-channel-webhook-events`: webhooks que o canal
 * tem hoje → o que fazer para que o nosso assine todos os eventos obrigatórios.
 *
 * O `PATCH` da HubMessage **substitui** a lista de eventos, então a lista enviada é
 * a união — mandar só os obrigatórios apagaria evento assinado à mão no painel.
 */

export type ChannelWebhookSnapshot = {
  id: string
  url: string
  events: string[]
}

export type ChannelWebhookEventsDecision =
  | { kind: 'unchanged'; webhookId: string }
  | { kind: 'update'; webhookId: string; events: string[]; missing: string[] }
  | { kind: 'create'; events: string[] }
  /**
   * O canal tem webhook, mas nenhum para a URL deste ambiente. Não cria: é o
   * sintoma de rodar o script com o \`.env\` errado (um túnel de dev contra canais de
   * produção), e criar ali desviaria as mensagens do canal para a URL errada.
   */
  | { kind: 'foreign'; urls: string[] }

/** URL comparada sem barra final: a mesma rota digitada de dois jeitos no painel. */
const sameUrl = (a: string, b: string): boolean =>
  a.replace(/\/+$/, '') === b.replace(/\/+$/, '')

export const resolveChannelWebhookEvents = (input: {
  webhooks: ChannelWebhookSnapshot[]
  webhookUrl: string
  requiredEvents: readonly string[]
}): ChannelWebhookEventsDecision => {
  const ours = input.webhooks.filter(webhook =>
    sameUrl(webhook.url, input.webhookUrl),
  )

  if (ours.length === 0) {
    return input.webhooks.length === 0
      ? { kind: 'create', events: [...input.requiredEvents] }
      : { kind: 'foreign', urls: input.webhooks.map(webhook => webhook.url) }
  }

  // Mais de um webhook para a nossa URL: o que já assina mais eventos é o que
  // vale atualizar; os outros continuam entregando o que já entregavam.
  const [target] = [...ours].sort((a, b) => b.events.length - a.events.length)
  const missing = input.requiredEvents.filter(
    event => !target!.events.includes(event),
  )

  if (missing.length === 0) return { kind: 'unchanged', webhookId: target!.id }

  return {
    kind: 'update',
    webhookId: target!.id,
    events: [...target!.events, ...missing],
    missing,
  }
}
