// O evento do bot traz `chat.id`, não a linha que o vínculo usa. A ponte é
// `imopenlines.dialog.get`, cujo `entity_id` é posicional: `connector|openline|chat|user`
// (ex.: `livechat|22|1775|599`, onde `22` é a linha). Parser separado porque posicional
// falha em silêncio — um campo a mais devolveria o id de outra coisa e o bot rodaria o
// fluxo do canal errado sem nenhum erro.

/** Índice do `CONFIG_ID` em `connector|openline|chat|user`. */
const OPENLINE_INDEX = 1
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
  }
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
