// O evento do bot traz `chat.id`, não a linha que o vínculo usa. A ponte é
// `imopenlines.dialog.get`, cujo `entity_id` é posicional: `connector|openline|chat|user`
// (ex.: `livechat|22|1775|599`, onde `22` é a linha). Parser separado porque posicional
// falha em silêncio — um campo a mais devolveria o id de outra coisa e o bot rodaria o
// fluxo do canal errado sem nenhum erro.

/** Índice do `CONFIG_ID` em `connector|openline|chat|user`. */
const OPENLINE_INDEX = 1
/**
 * Índice do chat do **conector** — o identificador do contato no provider, que o
 * `bitrix-received-message.processor` usa como telefone no envio. Não confundir com o
 * `CHAT_ID` do canal aberto, que é outro número e é o que o bot recebe no evento.
 */
const CONNECTOR_CHAT_INDEX = 2
const EXPECTED_PARTS = 4

export function parseOpenLineIdFromEntityId(entityId: unknown): string | null {
  if (typeof entityId !== 'string') return null

  const parts = entityId.split('|')

  // `entity_id` de outro tipo de chat não é uma linha: pegar o índice 1 de qualquer jeito
  // faria o vínculo casar com um canal que não é este.
  if (parts.length !== EXPECTED_PARTS) return null

  const lineId = parts[OPENLINE_INDEX]?.trim() ?? ''

  // Tem de ser numérico: `CONFIG_ID` é inteiro, e `''`/texto aqui é forma quebrada.
  if (!/^\d+$/.test(lineId)) return null

  return lineId
}

type DialogGetResponse = {
  result?: {
    entity_id?: unknown
    entity_type?: unknown
    name?: unknown
    title?: unknown
  }
}

/**
 * Nome do contato, lido do nome do chat do canal aberto.
 *
 * O campo é `name`; `title` vai junto porque a resposta foi lida dele antes e nada
 * garante que uma versão do portal não o devolva assim — vazio nos dois é o caso real de
 * chat sem nome ainda.
 *
 * O chat se chama `<contato> - <nome da linha>` (medido 2026-09-24, chat 9644:
 * `Gustavo Henrique - Teste Amanda - Gerais`), então corta no primeiro separador. A
 * linha pode ter ` - ` no próprio nome, como nesse exemplo, e é por isso que o corte é
 * no primeiro e não no último.
 */
export function contactNameFromDialog(response: unknown): string {
  const result = (response as DialogGetResponse | undefined)?.result
  const bruto = [result?.name, result?.title].find(
    valor => typeof valor === 'string' && valor.trim(),
  )

  if (typeof bruto !== 'string') return ''

  return (bruto.split(' - ')[0] ?? '').trim()
}

// Confere `entity_type` porque chat que não é de canal aberto não tem linha.
export function openLineIdFromDialog(response: unknown): string | null {
  const result = (response as DialogGetResponse | undefined)?.result
  if (!result) return null

  // Forma inesperada vale como "sem tipo" e a decisão fica com o `entity_id`, que é
  // validado de todo jeito; `String({})` daria `[object Object]` e recusaria chat legítimo.
  const tipo =
    typeof result.entity_type === 'string'
      ? result.entity_type.toUpperCase()
      : ''
  if (tipo && tipo !== 'LINES') return null

  return parseOpenLineIdFromEntityId(result.entity_id)
}

/**
 * Identificador do contato no provider, lido do mesmo `entity_id`.
 *
 * É o que o envio ao WhatsApp usa como destino — o `bitrix-received-message.processor`
 * chama isso de `chatId` e o passa como `phone` ao Z-API. O bot precisa dele porque a
 * fala não sai pelo Bitrix: a mensagem nasce no chat do canal aberto e não atravessa o
 * conector, então quem entrega ao contato somos nós.
 */
export function connectorChatIdFromDialog(response: unknown): string | null {
  const result = (response as DialogGetResponse | undefined)?.result
  if (!result) return null

  const tipo =
    typeof result.entity_type === 'string'
      ? result.entity_type.toUpperCase()
      : ''
  if (tipo && tipo !== 'LINES') return null

  if (typeof result.entity_id !== 'string') return null

  const parts = result.entity_id.split('|')
  if (parts.length !== EXPECTED_PARTS) return null

  // Sem validar como número: o identificador do contato é um telefone em alguns
  // conectores e um id opaco em outros, então só a forma vazia é recusada.
  return parts[CONNECTOR_CHAT_INDEX]?.trim() || null
}
