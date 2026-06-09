/**
 * Transformação de valor de célula (string crua da planilha) → parâmetros do
 * Bitrix, por tipo de campo. Espelha a lógica do fluxo Prismatic de produção:
 * crm_status / enumeration / date / datetime / money / phone / email / multiple.
 *
 * Saída = lista de parâmetros estruturados (path + value). A serialização pra
 * querystring do batch fica no writer.
 */

export type BitrixFieldMeta = {
  type: string
  isMultiple: boolean
  /** Para enumeration: itens {ID, VALUE}. */
  enumItems?: { ID: string; VALUE: string }[]
  /** Para crm_status: nome da lista de status (resolvida à parte). */
  statusType?: string
}

/** Listas de status resolvidas (crm.status.entity.items), por statusType. */
export type StatusLists = Record<string, { STATUS_ID: string; NAME: string }[]>

export type FieldParam = {
  /** Caminho dentro de `fields`, ex. ['CODE'] ou ['CODE','0','VALUE']. */
  path: string[]
  value: string
}

/** Máscara de CPF: 000.000.000-00. */
const CPF_MASK = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/
/**
 * Máscara de CNPJ. Desde jul/2026 o CNPJ é alfanumérico: 12 posições
 * alfanuméricas (base) + 2 dígitos verificadores numéricos → XX.XXX.XXX/XXXX-00.
 * O CPF antigo (só dígitos) continua casando como subcaso.
 */
const CNPJ_MASK =
  /^[0-9A-Za-z]{2}\.[0-9A-Za-z]{3}\.[0-9A-Za-z]{3}\/[0-9A-Za-z]{4}-\d{2}$/

/**
 * Tira a pontuação de CPF/CNPJ quando o valor casa a máscara (auto por formato).
 * CPF → só dígitos; CNPJ → alfanumérico em maiúsculo (padrão da Receita).
 * Valor que não casa a máscara volta intacto (não mexe em outros campos).
 */
export function normalizeBrazilianDoc(raw: string): string {
  const value = raw.trim()
  if (CPF_MASK.test(value) || CNPJ_MASK.test(value)) {
    return value.replace(/[.\-/]/g, '').toUpperCase()
  }
  return value
}

const TZ_OFFSET_HOURS = -3

function parseBrDate(raw: string): string | null {
  const [datePart, timePart] = raw.trim().split(' ')
  if (!datePart) return null
  const [day, month, year] = datePart.split('/')
  if (!day || !month || !year) return null
  const time = timePart || '00:00:00'
  const dt = new Date(`${month}/${day}/${year} ${time}`)
  if (Number.isNaN(dt.getTime())) return null
  dt.setHours(dt.getHours() + TZ_OFFSET_HOURS)
  return dt.toISOString()
}

function parseMoney(raw: string): string {
  return raw.replaceAll('R$', '').replaceAll('.', '').replace(',', '.').trim()
}

/** Bitrix boolean = 'Y'/'N'. Normaliza valores comuns de verdadeiro. */
const TRUTHY = new Set(['y', 'yes', 's', 'sim', '1', 'true', 'verdadeiro', 'x'])
function parseBoolean(raw: string): string {
  return TRUTHY.has(raw.trim().toLowerCase()) ? 'Y' : 'N'
}

/**
 * Converte um valor cru no(s) parâmetro(s) Bitrix do campo `code`.
 * Retorna [] quando o valor é vazio ou não resolve (campo ignorado na linha).
 */
export function transformFieldValue(
  code: string,
  meta: BitrixFieldMeta | undefined,
  raw: string,
  statusLists: StatusLists,
): FieldParam[] {
  // Normaliza CPF/CNPJ por máscara antes de qualquer transform (formato bate
  // com o armazenado no Bitrix → grava limpo e casa o dedup).
  const value = normalizeBrazilianDoc((raw ?? '').trim())
  if (value === '') return []

  // 'id' nunca é escrito (é só identificador de busca).
  if (code.toLowerCase() === 'id') return []

  const type = meta?.type

  if (type === 'crm_status' && meta?.statusType) {
    const list = statusLists[meta.statusType] ?? []
    const status = list.find(s => s.NAME === value)
    return [{ path: [code], value: status ? status.STATUS_ID : value }]
  }

  if (type === 'enumeration') {
    const item = meta?.enumItems?.find(e => e.VALUE === value)
    if (!item) return []
    return meta?.isMultiple
      ? [{ path: [code, '0'], value: item.ID }]
      : [{ path: [code], value: item.ID }]
  }

  if (type === 'date' || type === 'datetime') {
    const iso = parseBrDate(value)
    return iso ? [{ path: [code], value: iso }] : []
  }

  if (type === 'money') {
    return [{ path: [code], value: parseMoney(value) }]
  }

  if (type === 'boolean') {
    return [{ path: [code], value: parseBoolean(value) }]
  }

  const lower = code.toLowerCase()
  // Timeline comment: ENTITY_TYPE digitado livre na planilha ('Deal ', ' deaL')
  // → Bitrix exige a constante MAIÚSCULA (DEAL/LEAD/COMPANY/CONTACT). Já veio
  // trim; só sobe pra caixa-alta p/ casar o tipo de entidade.
  if (lower === 'entity_type') {
    return [{ path: [code], value: value.toUpperCase() }]
  }
  if (lower === 'phone' || lower === 'email') {
    // Multivalor: fields[CODE][0][VALUE]=...
    return [{ path: [code, '0', 'VALUE'], value }]
  }

  if (meta?.isMultiple) {
    return [{ path: [code, '0'], value: value.replaceAll('#', '') }]
  }

  return [{ path: [code], value: value.replaceAll('#', '') }]
}
