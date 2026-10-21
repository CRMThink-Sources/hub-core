import type {
  CadenceQueueItem,
  CadenceQueueListing,
} from '@/app/hooks/use-line-api'

/**
 * Regras puras da tabela de mensagens aguardando no card Cadenciador. Devolvem
 * **chaves** de tradução (e os valores para interpolar), não texto: o card traduz.
 */

/** HH:mm do horário de Brasília — o mesmo dos avisos do servidor. */
export function horaDe(epochMs: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(epochMs))
}

/** Chave do rótulo da origem, em `cadenciador.fila.origens`. */
export function origemKey(item: Pick<CadenceQueueItem, 'origin'>): string {
  return `cadenciador.fila.origens.${item.origin}`
}

/**
 * O que a coluna "Conteúdo" mostra: o trecho que a api mandou; em mídia, o tipo vem
 * antes (📎 Documento · contrato.pdf); mídia sem nome mostra só o tipo.
 */
export function conteudoDe(
  item: Pick<CadenceQueueItem, 'preview' | 'mediaType'>,
): { midiaKey: string | null; texto: string | null } {
  return {
    midiaKey: item.mediaType
      ? `cadenciador.fila.midia.${item.mediaType}`
      : null,
    texto: item.preview,
  }
}

/** Mensagens por página da tabela. */
export const FILA_PAGE_SIZE = 10

/** O intervalo "11–20 de 23" da página, pelas posições na fila inteira. */
export function intervaloDe(listing: CadenceQueueListing): {
  inicio: number
  fim: number
  total: number
} {
  const inicio = listing.total === 0 ? 0 : listing.offset + 1
  return {
    inicio,
    fim: Math.min(listing.offset + listing.limit, listing.total),
    total: listing.total,
  }
}

export function temAnterior(listing: CadenceQueueListing): boolean {
  return listing.offset > 0
}

export function temProxima(listing: CadenceQueueListing): boolean {
  return listing.offset + listing.limit < listing.total
}

/**
 * Offset da página a abrir quando a fila encolheu: se a página pedida passou do fim,
 * a última que existe; senão, a mesma. Fila vazia volta à primeira.
 */
export function offsetValido(
  offset: number,
  total: number,
  pageSize: number = FILA_PAGE_SIZE,
): number {
  if (total <= 0) return 0
  if (offset < total) return offset
  return Math.floor((total - 1) / pageSize) * pageSize
}

/** A tabela só aparece com mensagem listada. */
export function mostrarFila(listing: CadenceQueueListing | null): boolean {
  return listing !== null && listing.messages.length > 0
}
