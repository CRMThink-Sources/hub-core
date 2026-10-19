/**
 * Ids dos arquivos da propriedade `file` do robô "Enviar mensagem".
 *
 * Formato capturado em homolog (campo de arquivo múltiplo do negócio, dois
 * arquivos): `properties.file = ["422204", "422206"]` — ids da tabela de arquivos
 * do portal (`b_file`), sem nome, tipo nem link. Não são ids do Disk. O download
 * sai do campo de arquivo do documento: ver `fetch-robot-files.ts`.
 *
 * Aceita também string única e objeto por índice (`{ "0": "1", "1": "2" }`, a
 * forma que o `express.urlencoded` com `extended: true` dá a listas grandes).
 * Valor ausente ou vazio devolve `[]`. Ids repetidos saem uma vez, na ordem.
 */
export function parseRobotFiles(raw: unknown): string[] {
  const values = toValues(raw)
  const ids: string[] = []

  for (const value of values) {
    const id = String(value).trim()
    if (/^\d+$/.test(id) && !ids.includes(id)) ids.push(id)
  }

  return ids
}

function toValues(raw: unknown): unknown[] {
  if (raw === undefined || raw === null) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'object') return Object.values(raw)
  return [raw]
}
