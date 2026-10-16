import type {
  TemplateButton,
  TemplateCategory,
  TemplateComponent,
} from '@/app/hooks/use-connector-templates'

/**
 * Espelho de `api/src/modules/thinkzap/domain/template-buttons.ts` — mesmos
 * limites e mesmos códigos de violação. Mudou lá, muda aqui: a API recusa o que
 * escapar desta validação, mas aí o operador vê o erro só depois de enviar.
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

const URL_VARIABLE = /\{\{\s*\d+\s*\}\}/
const URL_TRAILING_VARIABLE = /\{\{\s*1\s*\}\}$/

export type TemplateButtonSummary = {
  /** Posição entre todos os botões do template, a partir de 0. */
  index: number
  type: TemplateButton['type'] | 'OTHER'
  text: string
  /** `URL` com variável ou `COPY_CODE`: o envio precisa de um valor. */
  dynamic: boolean
}

/** Lê os botões crus do `BUTTONS`; tipo desconhecido vira `OTHER` estático. */
export function templateButtonsOf(
  components: TemplateComponent[],
): TemplateButtonSummary[] {
  const component = components.find(c => c.type === 'BUTTONS')
  const raw: unknown[] = Array.isArray(component?.buttons)
    ? component.buttons
    : []

  return raw.map((button, index) => {
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
  })
}

export type TemplateButtonViolationCode =
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

export type TemplateButtonViolation = {
  index?: number
  code: TemplateButtonViolationCode
}

/** Valida contra os limites da Meta; vazio é válido. */
export function validateTemplateButtons(
  buttons: TemplateButton[],
  category: TemplateCategory,
): TemplateButtonViolation[] {
  if (buttons.length === 0) return []
  if (category === 'AUTHENTICATION') return [{ code: 'buttons_not_allowed' }]

  const violations: TemplateButtonViolation[] = []

  if (buttons.length > TEMPLATE_BUTTON_LIMITS.total) {
    violations.push({ code: 'too_many_buttons' })
  }

  buttons.forEach((button, index) => {
    violations.push(...validateButton(button, index, category))
  })

  for (const type of ['URL', 'PHONE_NUMBER', 'COPY_CODE'] as const) {
    if (countOf(buttons, type) > TEMPLATE_BUTTON_LIMITS[type]) {
      violations.push({ code: 'too_many_of_type' })
    }
  }

  return violations
}

export function countOf(
  buttons: TemplateButton[],
  type: TemplateButton['type'],
): number {
  return buttons.filter(button => button.type === type).length
}

/** Se ainda cabe mais um botão deste tipo — para habilitar o "+ tipo". */
export function canAddButton(
  buttons: TemplateButton[],
  type: TemplateButton['type'],
  category: TemplateCategory,
): boolean {
  if (!allowedButtonTypes(category).includes(type)) return false
  if (buttons.length >= TEMPLATE_BUTTON_LIMITS.total) return false
  if (type === 'QUICK_REPLY') return true
  return countOf(buttons, type) < TEMPLATE_BUTTON_LIMITS[type]
}

/** Tipos oferecidos na categoria: nada em Autenticação, cupom só em Marketing. */
export function allowedButtonTypes(
  category: TemplateCategory,
): TemplateButton['type'][] {
  if (category === 'AUTHENTICATION') return []
  if (category === 'MARKETING') {
    return ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE']
  }
  return ['QUICK_REPLY', 'URL', 'PHONE_NUMBER']
}

/** Se a URL tem a variável `{{1}}` (e então pede exemplo). */
export function isDynamicUrl(url: string): boolean {
  return URL_VARIABLE.test(url)
}

/**
 * O componente `BUTTONS` como a API espera, ou `null` sem botões.
 *
 * Respostas rápidas vão primeiro, juntas: a Meta recusa template com resposta
 * rápida intercalada entre botões de ação. Dentro de cada grupo, a ordem é a em que
 * o operador adicionou. Campos são aparados, e o `example` só vai em URL dinâmica.
 */
export function buildButtonsComponent(
  buttons: TemplateButton[],
): TemplateComponent | null {
  if (buttons.length === 0) return null

  const ordered = [
    ...buttons.filter(button => button.type === 'QUICK_REPLY'),
    ...buttons.filter(button => button.type !== 'QUICK_REPLY'),
  ]

  return { type: 'BUTTONS', buttons: ordered.map(normalizeButton) }
}

function normalizeButton(button: TemplateButton): TemplateButton {
  switch (button.type) {
    case 'QUICK_REPLY':
      return { type: 'QUICK_REPLY', text: button.text.trim() }
    case 'URL': {
      const url = button.url.trim()
      const example = button.example?.[0]?.trim()
      return isDynamicUrl(url) && example
        ? { type: 'URL', text: button.text.trim(), url, example: [example] }
        : { type: 'URL', text: button.text.trim(), url }
    }
    case 'PHONE_NUMBER':
      return {
        type: 'PHONE_NUMBER',
        text: button.text.trim(),
        phone_number: button.phone_number.trim(),
      }
    case 'COPY_CODE':
      return { type: 'COPY_CODE', example: button.example.trim() }
  }
}

function validateButton(
  button: TemplateButton,
  index: number,
  category: TemplateCategory,
): TemplateButtonViolation[] {
  const at = (code: TemplateButtonViolationCode) => ({ index, code })

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

type At = (code: TemplateButtonViolationCode) => TemplateButtonViolation

function validateText(text: string, at: At): TemplateButtonViolation[] {
  const value = text.trim()
  if (!value) return [at('text_required')]
  if (value.length > TEMPLATE_BUTTON_LIMITS.textLength) {
    return [at('text_too_long')]
  }
  return []
}

function validateUrl(
  button: Extract<TemplateButton, { type: 'URL' }>,
  at: At,
): TemplateButtonViolation[] {
  const url = button.url.trim()
  if (!url) return [at('url_required')]
  if (url.length > TEMPLATE_BUTTON_LIMITS.urlLength) return [at('url_too_long')]
  if (!isDynamicUrl(url)) return []

  const variables = url.match(new RegExp(URL_VARIABLE, 'g')) ?? []
  if (variables.length > 1 || !URL_TRAILING_VARIABLE.test(url)) {
    return [at('url_variable_position')]
  }

  if (!button.example?.[0]?.trim()) return [at('url_example_required')]
  return []
}

function validatePhone(
  button: Extract<TemplateButton, { type: 'PHONE_NUMBER' }>,
  at: At,
): TemplateButtonViolation[] {
  const phone = button.phone_number.trim()
  if (!phone) return [at('phone_required')]
  if (
    phone.length > TEMPLATE_BUTTON_LIMITS.phoneLength ||
    !/^\+?\d+$/.test(phone)
  ) {
    return [at('phone_invalid')]
  }
  return []
}

function validateCode(code: string, at: At): TemplateButtonViolation[] {
  const value = code.trim()
  if (!value) return [at('code_required')]
  if (value.length > TEMPLATE_BUTTON_LIMITS.codeLength) {
    return [at('code_too_long')]
  }
  return []
}
