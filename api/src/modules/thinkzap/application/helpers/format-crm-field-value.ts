import type { CrmFieldMeta } from './crm-field-catalog'

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/

/**
 * Valor cru que só se entende com a descrição do campo: um número ou `Y`/`N` pode ser
 * o código de uma opção de lista, um sim/não ou um simples número. Quem lê o registro
 * usa isto para só pedir `crm.item.fields` quando precisa.
 */
export function isAmbiguousCrmValue(raw: unknown): boolean {
  if (Array.isArray(raw)) return raw.some(isAmbiguousCrmValue)
  if (typeof raw === 'number' || typeof raw === 'boolean') return true
  if (typeof raw !== 'string') return false
  return /^\d+$/.test(raw.trim()) || raw === 'Y' || raw === 'N'
}

/**
 * Valor de um campo do CRM como texto pronto para o corpo do template, ou
 * `undefined` quando não há o que mostrar.
 *
 * Nunca devolve `null`, `undefined` ou `[object Object]` como texto: variável sem
 * valor fica em branco e o operador preenche, que é melhor que mandar lixo ao
 * contato.
 *
 * Sem `meta` só se resolve o que é inequívoco (texto, data ISO, dinheiro); valor
 * ambíguo (ver `isAmbiguousCrmValue`) vira `undefined` em vez de arriscar mostrar o
 * código de uma opção.
 */
export function formatCrmFieldValue(
  raw: unknown,
  meta: CrmFieldMeta | undefined,
): string | undefined {
  if (raw === null || raw === undefined) return undefined

  if (meta?.type === 'crm_multifield' || isMultifieldValue(raw)) {
    return firstMultifieldValue(raw)
  }

  if (Array.isArray(raw)) {
    const parts = raw
      .map(item => formatCrmFieldValue(item, meta))
      .filter((part): part is string => part !== undefined)
    return parts.length ? parts.join(', ') : undefined
  }

  if (meta?.type === 'enumeration') return enumerationLabel(raw, meta)

  if (meta?.type === 'boolean' || meta?.type === 'char') {
    const bool = toBoolean(raw)
    if (bool !== undefined) return bool ? 'Sim' : 'Não'
  }

  if (typeof raw === 'string') return formatString(raw, meta)

  if (typeof raw === 'number') return meta ? String(raw) : undefined

  if (typeof raw === 'boolean') {
    return meta ? (raw ? 'Sim' : 'Não') : undefined
  }

  return undefined
}

function formatString(raw: string, meta: CrmFieldMeta | undefined) {
  const text = raw.trim()
  if (!text) return undefined

  if (meta?.type === 'money' || /^-?\d+(\.\d+)?\|[A-Z]{3}$/.test(text)) {
    return text.split('|')[0]
  }

  const isDate =
    meta?.type === 'date' || meta?.type === 'datetime' || ISO_DATE.test(text)
  if (isDate) {
    const match = ISO_DATE.exec(text)
    // A data como o Bitrix a guarda: converter pelo fuso a deslocaria um dia.
    if (match) return `${match[3]}/${match[2]}/${match[1]}`
  }

  if (!meta && isAmbiguousCrmValue(text)) return undefined
  return text
}

function enumerationLabel(
  raw: unknown,
  meta: CrmFieldMeta,
): string | undefined {
  const code = String(raw)
  const item = meta.items?.find(option => String(option.ID) === code)
  return item?.VALUE?.trim() || undefined
}

function toBoolean(raw: unknown): boolean | undefined {
  if (raw === true || raw === 'Y' || raw === 'true' || raw === 1) return true
  if (raw === false || raw === 'N' || raw === 'false' || raw === 0) return false
  return undefined
}

/** `[{ id, valueType, value }]`: o formato de telefone, e-mail, site e mensageiro. */
function isMultifieldValue(raw: unknown): boolean {
  return (
    Array.isArray(raw) &&
    raw.length > 0 &&
    raw.every(
      item => typeof item === 'object' && item !== null && 'value' in item,
    )
  )
}

function firstMultifieldValue(raw: unknown): string | undefined {
  if (!Array.isArray(raw)) return undefined
  for (const item of raw) {
    const value = (item as { value?: unknown } | null)?.value
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}
