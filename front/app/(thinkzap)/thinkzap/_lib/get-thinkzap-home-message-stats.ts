import type { ThinkzapHttpClient } from '@/infra/client/axios-thinkzap'

export type MessageDirectionCounts = {
  sent: number
  received: number
}

/** Chave ausente = domínio sem linha ativa daquele provider. */
export type ThinkzapHomeMessageStats = {
  zapi?: MessageDirectionCounts
  hubmessage?: MessageDirectionCounts
}

/**
 * `GET /thinkzap/home/message-stats` — contagem de mensagens enviadas/recebidas
 * por provider, agregada por domínio, no período informado.
 *
 * O backend recusa (`400`) range acima de 6 meses — a UI já impede a seleção
 * antes de chegar aqui (`resolveMaxHomeStatsRangeEnd`), mas o erro do servidor é
 * a autoridade final.
 */
export async function getThinkzapHomeMessageStats(
  client: ThinkzapHttpClient,
  range: { from: Date; to: Date },
): Promise<ThinkzapHomeMessageStats> {
  return client.get<ThinkzapHomeMessageStats>('/thinkzap/home/message-stats', {
    params: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    },
  })
}
