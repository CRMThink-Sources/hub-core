import type { OutboundMessageDescriptor } from '@/modules/thinkzap/domain/ports/outbound-message-sender.port'

const CAPTIONABLE_KINDS: ReadonlySet<OutboundMessageDescriptor['kind']> =
  new Set(['image', 'video', 'document'])

/**
 * Junta texto e mídia nas partes a enviar, na ordem do canal aberto: o texto
 * vira legenda do primeiro anexo legendável; senão (primeiro anexo é áudio) sai
 * como texto separado antes da mídia. Sem mídia, só o texto; sem nada, nenhuma
 * parte.
 *
 * Usado pela resposta do operador no canal aberto e pelo robô "Enviar mensagem".
 */
export function buildCaptionedParts(
  text: string | undefined,
  media: OutboundMessageDescriptor[],
): OutboundMessageDescriptor[] {
  if (!media.length) return text ? [{ kind: 'text', text }] : []

  if (!text) return media

  const first = media[0]

  if (first && CAPTIONABLE_KINDS.has(first.kind)) {
    return [{ ...first, text }, ...media.slice(1)]
  }

  return [{ kind: 'text', text }, ...media]
}
