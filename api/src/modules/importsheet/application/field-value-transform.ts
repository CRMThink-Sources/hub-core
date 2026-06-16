/**
 * Transformação de valor de célula (string crua da planilha) → parâmetros do
 * Bitrix, por tipo de campo. Espelha a lógica do fluxo Prismatic de produção:
 * crm_status / enumeration / date / datetime / money / phone / email / multiple.
 *
 * Saída = lista de parâmetros estruturados (path + value). A serialização pra
 * querystring do batch fica no writer.
 */

import { apiLogger } from '@/shared/infra/logger'

export type BitrixFieldMeta = {
  type: string
  isMultiple: boolean
  /** Para enumeration: itens {ID, VALUE}. */
  enumItems?: { ID: string; VALUE: string }[]
  /** Para crm_status: nome da lista de status (resolvida à parte). */
  statusType?: string
  /** Para campos `money`: moeda base do portal (ex. 'BRL'). Bitrix exige `valor|MOEDA`. */
  currency?: string
}

/** Listas de status resolvidas (crm.status.entity.items), por statusType. */
export type StatusLists = Record<string, { STATUS_ID: string; NAME: string }[]>

export type FieldParam = {
  /** Caminho dentro de `fields`, ex. ['CODE'] ou ['CODE','0','VALUE']. */
  path: string[]
  value: string
}

// Multifield (PHONE/EMAIL): transform emite path [MULTIFIELD_SENTINEL, typeId];
// o mapRow expande no formato `fm` do crm.item com índice único por linha.
export const MULTIFIELD_SENTINEL = '__multifield__'

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

// Data BR `DD/MM/YYYY [HH:mm[:ss]]` → ISO via `Date.UTC` (determinístico, sem
// depender do parser do Node). Valida faixas e overflow (31/02 → null).
function parseBrDate(raw: string): string | null {
  const [datePart, timePart] = raw.trim().split(/\s+/)
  if (!datePart) return null
  const [day, month, yearRaw] = datePart.split('/').map(Number)
  if (!day || !month || !yearRaw) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  // Ano de 2 dígitos (dd/mm/yy): mesmo pivô do Google Sheets — 00-29 → 2000-2029,
  // 30-99 → 1930-1999. Ex.: 26→2026, 85→1985. Evita o 0-99→1900-1999 do Date.UTC.
  const year =
    yearRaw < 100 ? (yearRaw <= 29 ? 2000 + yearRaw : 1900 + yearRaw) : yearRaw

  const [hour = 0, minute = 0, second = 0] = (timePart ?? '')
    .split(':')
    .map(Number)
  if (hour > 23 || minute > 59 || second > 59) return null

  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second)
  const check = new Date(utcMs)
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null
  }
  return new Date(utcMs - TZ_OFFSET_HOURS * 60 * 60 * 1000).toISOString()
}

// Money → decimal com ponto, BR e US. Separador mais à direita = decimal; os
// outros = milhar. Limitação: separador único vira decimal ("1.000"→1.0).
function parseMoney(raw: string): string {
  const cleaned = raw.replace(/[^\d.,-]/g, '').trim()
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  const decimalSep = lastComma > lastDot ? ',' : lastDot > -1 ? '.' : ''
  if (decimalSep === '') return cleaned
  const intPart = cleaned
    .slice(0, cleaned.lastIndexOf(decimalSep))
    .replace(/[.,]/g, '')
  const decPart = cleaned.slice(cleaned.lastIndexOf(decimalSep) + 1)
  return `${intPart}.${decPart}`
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
    // Sem match → ignora (não manda texto cru como STATUS_ID).
    if (!status) {
      apiLogger.warn(
        { app: 'importsheet', code, value, statusType: meta.statusType },
        'crm_status sem match na lista — campo ignorado',
      )
      return []
    }
    return [{ path: [code], value: status.STATUS_ID }]
  }

  if (type === 'enumeration') {
    const item = meta?.enumItems?.find(e => e.VALUE === value)
    if (!item) {
      apiLogger.warn(
        { app: 'importsheet', code, value },
        'enumeration sem match nos itens — campo ignorado',
      )
      return []
    }
    return meta?.isMultiple
      ? [{ path: [code, '0'], value: item.ID }]
      : [{ path: [code], value: item.ID }]
  }

  if (type === 'date' || type === 'datetime') {
    // Campo `date` (sem hora) rejeita ISO com hora não-zero → descarta o trecho de
    // hora, ficando só a data (00:00). `datetime` mantém a hora informada.
    const input = type === 'date' ? (value.split(/\s+/)[0] ?? value) : value
    const iso = parseBrDate(input)
    return iso ? [{ path: [code], value: iso }] : []
  }

  // 'money' = campo monetário; 'double' = numérico (ex. OPPORTUNITY/valor do Negócio).
  // Ambos aceitam o parse BR/US. crm_currency (código da moeda) NÃO entra aqui.
  if (type === 'money' || type === 'double') {
    const money = parseMoney(value)
    // Lixo sem dígito → não manda campo (evita money vazio no Bitrix).
    if (!/\d/.test(money)) return []
    // Campo `money` do Bitrix guarda `valor|MOEDA` — sem a moeda dá "Moeda incorreta".
    // `double` é número puro (a moeda fica no CURRENCY_ID à parte) → vai sem sufixo.
    const out =
      type === 'money' && meta?.currency ? `${money}|${meta.currency}` : money
    return [{ path: [code], value: out }]
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
    // Multivalor: split(",") → uma entrada por valor (trim nos espaços). Phone vira só
    // dígitos (remove formatação), preservando '+' inicial (DDI); email fica intacto.
    // O índice no array `fm` é atribuído no mapRow; aqui só marcamos o typeId.
    const typeId = lower === 'phone' ? 'PHONE' : 'EMAIL'
    const parts = value
      .split(',')
      .map(v => {
        const trimmed = v.trim()
        if (lower !== 'phone') return trimmed
        const hasPlus = trimmed.startsWith('+')
        const digits = trimmed.replace(/\D/g, '')
        return hasPlus ? `+${digits}` : digits
      })
      .filter(v => v !== '' && v !== '+')
    return parts.map(v => ({ path: [MULTIFIELD_SENTINEL, typeId], value: v }))
  }

  if (meta?.isMultiple) {
    // '#' é separador interno de campo múltiplo no Bitrix → remove pra não quebrar.
    return [{ path: [code, '0'], value: value.replaceAll('#', '') }]
  }

  // Campo simples: valor intacto. Não remove '#' (dado legítimo, ex. "Apto #12").
  return [{ path: [code], value }]
}
