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

/** Quantas aguardam além das listadas (a api lista no máximo 50). */
export function foraDaLista(listing: CadenceQueueListing): number {
  return Math.max(0, listing.total - listing.messages.length)
}

/** A tabela só aparece com mensagem listada. */
export function mostrarFila(listing: CadenceQueueListing | null): boolean {
  return listing !== null && listing.messages.length > 0
}
