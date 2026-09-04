import type { InputValidation, QuestionNode, QuestionOption } from './flow'

// Sem botão no WhatsApp, a opção vira número e o cliente responde o que quiser: aceitar só
// o número travaria quem digita "manhã" em vez de "1".

/** Sem acento, sem pontuação, minúsculo, espaço colapsado. */
export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s@.]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type OptionMatch =
  | { matched: true; option: QuestionOption; by: 'number' | 'value' | 'label' }
  | { matched: false }

// Ordem: número (1-based, como o cliente vê), valor, rótulo, prefixo do rótulo. Prefixo só
// com 3+ caracteres e só se for único: "ca" casaria "Cancelar" e "Cartão" ao mesmo tempo.
export function matchOption(
  node: Pick<QuestionNode, 'options'>,
  answer: string,
): OptionMatch {
  const normalized = normalizeAnswer(answer)
  if (!normalized) return { matched: false }

  const asNumber = Number(normalized)
  if (Number.isInteger(asNumber) && asNumber >= 1) {
    const byPosition = node.options[asNumber - 1]
    if (byPosition) return { matched: true, option: byPosition, by: 'number' }
  }

  const byValue = node.options.find(
    option => normalizeAnswer(option.value) === normalized,
  )
  if (byValue) return { matched: true, option: byValue, by: 'value' }

  const byLabel = node.options.find(
    option => normalizeAnswer(option.label) === normalized,
  )
  if (byLabel) return { matched: true, option: byLabel, by: 'label' }

  if (normalized.length >= 3) {
    const prefixes = node.options.filter(option =>
      normalizeAnswer(option.label).startsWith(normalized),
    )
    if (prefixes.length === 1) {
      return { matched: true, option: prefixes[0]!, by: 'label' }
    }
  }

  return { matched: false }
}

/** Palavra de escape em qualquer lugar da frase: "quero falar com atendente". */
export function matchesEscape(answer: string, keywords: string[]): boolean {
  const normalized = normalizeAnswer(answer)
  if (!normalized) return false

  return keywords.some(keyword => {
    const target = normalizeAnswer(keyword)
    return target.length > 0 && normalized.includes(target)
  })
}

export type ValidationResult = { valid: true; value: string } | { valid: false }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Valida e normaliza: o que vai para a variável é a forma canônica, não o que o cliente
// digitou. Data vira `1990-12-31` para comparar e viajar; CPF vira dígito puro para casar
// no CRM.
export function validateInput(
  raw: string,
  validation: InputValidation,
): ValidationResult {
  const trimmed = raw.trim()
  if (!trimmed) return { valid: false }

  switch (validation) {
    case 'text':
      return { valid: true, value: trimmed }

    case 'email': {
      const value = trimmed.toLowerCase()
      return EMAIL.test(value) ? { valid: true, value } : { valid: false }
    }

    case 'number': {
      const value = trimmed.replace(',', '.')
      return Number.isFinite(Number(value))
        ? { valid: true, value: String(Number(value)) }
        : { valid: false }
    }

    case 'cpf': {
      const digits = trimmed.replace(/\D/g, '')
      return isValidCpf(digits)
        ? { valid: true, value: digits }
        : { valid: false }
    }

    case 'date':
      return parseDate(trimmed)
  }
}

/** `DD/MM/AAAA`, `DD-MM-AAAA` ou `AAAA-MM-DD` → `AAAA-MM-DD`. */
function parseDate(raw: string): ValidationResult {
  const digits = raw.match(/\d+/g)
  if (!digits || digits.length !== 3) return { valid: false }

  const [a, b, c] = digits as [string, string, string]
  const iso = a.length === 4
  const year = Number(iso ? a : c)
  const month = Number(b)
  const day = Number(iso ? c : a)

  if (year < 1900 || year > 2200) return { valid: false }
  if (month < 1 || month > 12) return { valid: false }

  const date = new Date(Date.UTC(year, month - 1, day))
  // Rejeita 31/02: o `Date` rola para março em vez de recusar.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { valid: false }
  }

  const pad = (value: number) => String(value).padStart(2, '0')
  return { valid: true, value: `${year}-${pad(month)}-${pad(day)}` }
}

/** Dígitos verificadores. Recusa também as sequências repetidas, que passam no cálculo. */
function isValidCpf(digits: string): boolean {
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false

  const checkDigit = (length: number): number => {
    let sum = 0
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index)
    }
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }

  return (
    checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10])
  )
}
