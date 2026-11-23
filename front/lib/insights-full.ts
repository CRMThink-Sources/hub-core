/**
 * Derivações puras dos blocos que só existem no modo completo do Insights
 * (Vibe API). No modo enxuto esses campos chegam null; aqui null nunca vira
 * `NaN` nem "Infinity" na tela.
 */

/**
 * Satisfação = likes / (likes + dislikes), em 0–100. Sem nenhuma nota (ou sem
 * dado) devolve null: "0% satisfeito" diria que o cliente avaliou mal quando
 * na verdade ninguém avaliou.
 */
export function satisfactionPercent(
  likes: number | null,
  dislikes: number | null,
): number | null {
  const up = likes ?? 0
  const down = dislikes ?? 0
  const total = up + down
  if (!Number.isFinite(total) || total <= 0) return null
  return (up / total) * 100
}

export type ReasonRow = { key: string; count: number; share: number }

/**
 * Motivos de fechamento do maior para o menor, com a fatia de cada um. As
 * chaves vêm da Vibe API e são desconhecidas: nada aqui assume um conjunto
 * fechado. Empate pela chave deixa a ordem estável entre leituras. Contagem
 * inválida some, e total zero dá fatia zero (largura de barra segura).
 */
export function sortReasons(
  reasons: Record<string, number> | null,
): ReasonRow[] {
  if (!reasons) return []
  const entries = Object.entries(reasons).filter(
    ([, count]) => Number.isFinite(count) && count >= 0,
  )
  const total = entries.reduce((acc, [, count]) => acc + count, 0)
  return entries
    .map(([key, count]) => ({
      key,
      count,
      share: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

const KNOWN_REASONS = ['auto', 'outro'] as const
export type KnownReason = (typeof KNOWN_REASONS)[number]

/**
 * Só as chaves que o painel sabe traduzir. `includes` em lista (e não busca em
 * objeto) para uma chave como `constructor` não passar por conhecida.
 */
export function knownReasonKey(key: string): KnownReason | null {
  return (KNOWN_REASONS as readonly string[]).includes(key)
    ? (key as KnownReason)
    : null
}

export type ChannelSlaRow = {
  name: string
  seconds: number
  /** Objetivo do canal comparado com a referência do painel. */
  versus: 'stricter' | 'same' | 'looser'
}

/**
 * Objetivo de primeira resposta de cada canal ao lado da referência do painel
 * (`slaMin`, em minutos). A referência do painel é escolha do cliente e não é
 * alterada pelo canal: aqui só se mostra a diferença.
 */
export function channelSlaVsMeta(
  channelSla: { name: string; seconds: number }[] | null,
  slaMin: number,
): ChannelSlaRow[] {
  if (!channelSla) return []
  const metaSec = slaMin * 60
  return channelSla.map(c => ({
    name: c.name,
    seconds: c.seconds,
    versus:
      c.seconds < metaSec
        ? 'stricter'
        : c.seconds > metaSec
          ? 'looser'
          : 'same',
  }))
}
