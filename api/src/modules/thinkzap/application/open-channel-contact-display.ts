/**
 * Nome e telefone do contato no canal aberto — **separados da identidade**.
 *
 * Antes desta separação os três eram o mesmo valor. `sendToOpenChannel` mostrava isso no
 * extremo: `chat.id`, `chat.name`, `user.id`, `user.name` e `user.phone` recebiam todos
 * o telefone canonizado. Enquanto a identidade era um telefone, isso passava; quando ela
 * virou LID, o mesmo código faria o LID aparecer como nome do contato e como telefone
 * dele no CRM.
 *
 * Os três papéis:
 *
 * - `chat.id`/`user.id` — identidade. Mudar o valor cria contato e sessão novos.
 * - `chat.name`/`user.name` — o que o operador lê.
 * - `user.phone` — telefone no CRM. Ausente é um valor válido; LID não é.
 */

/** Contato sem número visível e sem nome no WhatsApp precisa de algum rótulo. */
export const UNKNOWN_CONTACT_LABEL = 'Contato WhatsApp (sem número visível)'

/**
 * O nome exibido, na ordem em que as fontes valem a pena.
 *
 * Nenhum candidato que contenha `@lid` sobrevive: é a garantia de que o identificador
 * interno do WhatsApp não vaza para a tela do operador, mesmo que a Z-API o mande no
 * `senderName` de um contato sem push name.
 */
export function resolveContactDisplayName(
  candidates: Array<string | null | undefined>,
): string {
  for (const candidate of candidates) {
    const value = candidate?.trim()
    if (value && !value.includes('@lid')) return value
  }
  return UNKNOWN_CONTACT_LABEL
}

/**
 * O título do chat: nome e telefone quando há telefone, só o nome quando não há.
 *
 * O sufixo é condicional por causa do contato lid-only. O código antigo concatenava
 * `normalizePhoneNumber(event.phone)` incondicionalmente, e para `3577724534928@lid`
 * isso produzia `João - 3577724534928` — o LID disfarçado de telefone no título.
 */
export function buildOpenChannelChatName(
  name: string,
  phone: string | null,
): string {
  return phone ? `${name} - ${phone}` : name
}

/**
 * O bloco `user` do payload, com `phone` **omitido** quando não há telefone.
 *
 * Omitir e não mandar string vazia: o Bitrix trata a chave presente como valor a gravar,
 * e um telefone vazio no contato é pior que nenhum — some do lugar onde alguém iria
 * procurar por que não consegue ligar.
 */
export function buildOpenChannelUser(input: {
  id: string
  name: string
  phone: string | null
  pictureUrl?: string | null
}): {
  id: string
  name: string
  last_name: string
  phone?: string
  picture?: { url: string }
} {
  return {
    id: input.id,
    name: input.name,
    last_name: '',
    ...(input.phone ? { phone: input.phone } : {}),
    ...(input.pictureUrl ? { picture: { url: input.pictureUrl } } : {}),
  }
}
