import type {
  TemplateButton,
  TemplateCategory,
  TemplateComponent,
} from './ports/whatsapp-template-provider.port'

/**
 * Limites da Meta para botões de template. Espelhados no front
 * (`front/app/(thinkzap)/thinkzap/_components/configuracoes/oficial/template-buttons.ts`):
 * mudou aqui, muda lá. A Meta continua sendo a validação final — se o limite
 * dela mudar antes daqui, a recusa chega como `provider_rejected`.
 */
export const TEMPLATE_BUTTON_LIMITS = {
  total: 10,
  URL: 2,
  PHONE_NUMBER: 1,
  COPY_CODE: 1,
  textLength: 25,
  urlLength: 2000,
  phoneLength: 20,
  codeLength: 15,
} as const

/** Variável da URL dinâmica: só `{{1}}`, e só no fim. */
const URL_VARIABLE = /\{\{\s*\d+\s*\}\}/
const URL_TRAILING_VARIABLE = /\{\{\s*1\s*\}\}$/

/** Botão como o catálogo de envio precisa: o que mostrar e se pede valor. */
export type TemplateButtonSummary = {
  /** Posição entre **todos** os botões do template, a partir de 0 — o `index` do envio. */
  index: number
  type: TemplateButton['type'] | 'OTHER'
  text: string
  /** `URL` com variável ou `COPY_CODE`: o envio precisa de um valor para ele. */
  dynamic: boolean
}

/**
 * Lê os botões crus do `BUTTONS` de um template do catálogo.
 *
 * O catálogo vem ao vivo da Meta e pode ter botões que o ThinkZap não cria (fluxo,
 * OTP, catálogo...). Esses viram `OTHER` estático: o template continua enviável, só
 * não pedimos valor para eles.
 */
export function templateButtonsOf(
  components: TemplateComponent[],
): TemplateButtonSummary[] {
  const component = components.find(c => c.type === 'BUTTONS')
  const raw = Array.isArray(component?.buttons) ? component.buttons : []

  return raw.map((button: unknown, index) => summarize(button, index))
}

function summarize(button: unknown, index: number): TemplateButtonSummary {
  const record = (button ?? {}) as Record<string, unknown>
  const text = typeof record.text === 'string' ? record.text : ''

  switch (record.type) {
    case 'QUICK_REPLY':
    case 'PHONE_NUMBER':
      return { index, type: record.type, text, dynamic: false }
    case 'URL':
      return {
        index,
        type: 'URL',
        text,
        dynamic:
          typeof record.url === 'string' && URL_VARIABLE.test(record.url),
      }
    case 'COPY_CODE':
      return { index, type: 'COPY_CODE', text, dynamic: true }
    default:
      return { index, type: 'OTHER', text, dynamic: false }
  }
}

/** Uma violação, com a posição do botão quando ela é de um botão só. */
export type TemplateButtonViolation = {
  index?: number
  code:
    | 'buttons_not_allowed'
    | 'copy_code_not_allowed'
    | 'too_many_buttons'
    | 'too_many_of_type'
    | 'unsupported_type'
    | 'text_required'
    | 'text_too_long'
    | 'url_required'
    | 'url_too_long'
    | 'url_variable_position'
    | 'url_example_required'
    | 'phone_required'
    | 'phone_invalid'
    | 'code_required'
    | 'code_too_long'
}

/**
 * Valida os botões de um template novo contra os limites da Meta e as regras de
 * categoria. Devolve todas as violações (o front mostra por campo); vazio é válido.
 */
export function validateTemplateButtons(
  buttons: unknown[],
  category: TemplateCategory,
): TemplateButtonViolation[] {
  if (buttons.length === 0) return []
  if (category === 'AUTHENTICATION') return [{ code: 'buttons_not_allowed' }]

  const violations: TemplateButtonViolation[] = []

  if (buttons.length > TEMPLATE_BUTTON_LIMITS.total) {
    violations.push({ code: 'too_many_buttons' })
  }

  const counts: Record<string, number> = {}
  buttons.forEach((button, index) => {
    const record = (button ?? {}) as Record<string, unknown>
    const type = String(record.type)
    counts[type] = (counts[type] ?? 0) + 1
    violations.push(...validateButton(record, index, category))
  })

  for (const type of ['URL', 'PHONE_NUMBER', 'COPY_CODE'] as const) {
    if ((counts[type] ?? 0) > TEMPLATE_BUTTON_LIMITS[type]) {
      violations.push({ code: 'too_many_of_type' })
    }
  }

  return violations
}

function validateButton(
  button: Record<string, unknown>,
  index: number,
  category: TemplateCategory,
): TemplateButtonViolation[] {
  const at = (code: TemplateButtonViolation['code']) => ({ index, code })

  switch (button.type) {
    case 'QUICK_REPLY':
      return validateText(button.text, at)
    case 'URL':
      return [...validateText(button.text, at), ...validateUrl(button, at)]
    case 'PHONE_NUMBER':
      return [...validateText(button.text, at), ...validatePhone(button, at)]
    case 'COPY_CODE':
      if (category !== 'MARKETING') return [at('copy_code_not_allowed')]
      return validateCode(button.example, at)
    default:
      return [at('unsupported_type')]
  }
}

type At = (code: TemplateButtonViolation['code']) => TemplateButtonViolation

function validateText(text: unknown, at: At): TemplateButtonViolation[] {
  const value = typeof text === 'string' ? text.trim() : ''
  if (!value) return [at('text_required')]
  if (value.length > TEMPLATE_BUTTON_LIMITS.textLength)
    return [at('text_too_long')]
  return []
}

function validateUrl(
  button: Record<string, unknown>,
  at: At,
): TemplateButtonViolation[] {
  const url = typeof button.url === 'string' ? button.url.trim() : ''
  if (!url) return [at('url_required')]
  if (url.length > TEMPLATE_BUTTON_LIMITS.urlLength) return [at('url_too_long')]
  if (!URL_VARIABLE.test(url)) return []

  // Uma variável só, `{{1}}`, no fim: é o único formato que a Meta aceita em URL.
  const variables = url.match(new RegExp(URL_VARIABLE, 'g')) ?? []
  if (variables.length > 1 || !URL_TRAILING_VARIABLE.test(url)) {
    return [at('url_variable_position')]
  }

  const example: unknown = Array.isArray(button.example)
    ? button.example[0]
    : undefined
  if (typeof example !== 'string' || !example.trim()) {
    return [at('url_example_required')]
  }
  return []
}

function validatePhone(
  button: Record<string, unknown>,
  at: At,
): TemplateButtonViolation[] {
  const phone =
    typeof button.phone_number === 'string' ? button.phone_number.trim() : ''
  if (!phone) return [at('phone_required')]
  if (
    phone.length > TEMPLATE_BUTTON_LIMITS.phoneLength ||
    !/^\+?\d+$/.test(phone)
  ) {
    return [at('phone_invalid')]
  }
  return []
}

function validateCode(code: unknown, at: At): TemplateButtonViolation[] {
  const value = typeof code === 'string' ? code.trim() : ''
  if (!value) return [at('code_required')]
  if (value.length > TEMPLATE_BUTTON_LIMITS.codeLength)
    return [at('code_too_long')]
  return []
}
