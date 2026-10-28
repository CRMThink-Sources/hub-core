import type {
  ConnectorTemplate,
  TemplateButton,
  TemplateCategory,
  TemplateComponent,
  TemplateStatus,
} from '@/app/hooks/use-connector-templates'
import { templateHeaderOf } from './template-header'

/**
 * Regras puras da aba de templates: leitura dos componentes, busca e filtros,
 * quem pode ser editado e o estado inicial do formulário de edição.
 */

/** Texto de um componente (`BODY`, `FOOTER`), ou vazio. */
export function componentText(
  components: TemplateComponent[],
  type: 'BODY' | 'FOOTER',
): string {
  const text = components.find(c => c.type === type)?.text
  return typeof text === 'string' ? text : ''
}

export type TemplateFilters = {
  query: string
  status: TemplateStatus | 'ALL'
  category: TemplateCategory | 'ALL'
  onlyImage: boolean
}

export const EMPTY_FILTERS: TemplateFilters = {
  query: '',
  status: 'ALL',
  category: 'ALL',
  onlyImage: false,
}

export function hasActiveFilters(filters: TemplateFilters): boolean {
  return (
    filters.query.trim() !== '' ||
    filters.status !== 'ALL' ||
    filters.category !== 'ALL' ||
    filters.onlyImage
  )
}

/** Busca por nome e corpo, sem diferenciar maiúsculas nem acentos. */
export function filterTemplates(
  templates: ConnectorTemplate[],
  filters: TemplateFilters,
): ConnectorTemplate[] {
  const query = normalize(filters.query.trim())
  return templates.filter(template => {
    if (filters.status !== 'ALL' && template.status !== filters.status) {
      return false
    }
    if (filters.category !== 'ALL' && template.category !== filters.category) {
      return false
    }
    if (
      filters.onlyImage &&
      templateHeaderOf(template.components) !== 'IMAGE'
    ) {
      return false
    }
    if (!query) return true
    return (
      normalize(template.name).includes(query) ||
      normalize(componentText(template.components, 'BODY')).includes(query)
    )
  })
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * A Meta só deixa editar template aprovado ou rejeitado (pausado também, mas o
 * provedor não informa esse estado). Pendente está em análise.
 */
export function canEditTemplate(status: TemplateStatus): boolean {
  return status === 'APPROVED' || status === 'REJECTED'
}

/** Categoria de template aprovado não muda numa edição. */
export function categoryLocked(status: TemplateStatus): boolean {
  return status === 'APPROVED'
}

/** Trecho do texto de preview: texto puro ou uma variável `{{n}}`. */
export type PreviewSegment = { text: string; variable: boolean }

/** Separa as variáveis `{{n}}` para o preview destacá-las. */
export function previewSegments(text: string): PreviewSegment[] {
  const segments: PreviewSegment[] = []
  let last = 0
  for (const match of text.matchAll(/\{\{\s*\d+\s*\}\}/g)) {
    const start = match.index ?? 0
    if (start > last) {
      segments.push({ text: text.slice(last, start), variable: false })
    }
    segments.push({ text: match[0], variable: true })
    last = start + match[0].length
  }
  if (last < text.length) {
    segments.push({ text: text.slice(last), variable: false })
  }
  return segments
}

const BUTTON_TYPES = ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE']

/** Estado do formulário a partir de um template existente (modo edição). */
export type TemplateFormInitial = {
  name: string
  category: TemplateCategory
  language: string
  body: string
  footer: string
  header: 'NONE' | 'IMAGE'
  examples: Record<number, string>
  buttons: TemplateButton[]
}

export function formInitialOf(
  template: ConnectorTemplate,
): TemplateFormInitial {
  const body = template.components.find(c => c.type === 'BODY')
  const bodyText = typeof body?.text === 'string' ? body.text : ''
  const variables = [
    ...new Set(
      [...bodyText.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map(m => Number(m[1])),
    ),
  ].sort((a, b) => a - b)
  const sample = (body?.example as { body_text?: unknown[][] } | undefined)
    ?.body_text?.[0]
  const examples: Record<number, string> = {}
  variables.forEach((variable, i) => {
    const value = Array.isArray(sample) ? sample[i] : undefined
    if (typeof value === 'string') examples[variable] = value
  })

  const rawButtons = template.components.find(
    c => c.type === 'BUTTONS',
  )?.buttons
  const buttons = (Array.isArray(rawButtons) ? rawButtons : [])
    .filter(button => BUTTON_TYPES.includes(button.type))
    .map(toEditableButton)

  return {
    name: template.name,
    category: template.category,
    language: template.language,
    body: bodyText,
    footer: componentText(template.components, 'FOOTER'),
    header:
      templateHeaderOf(template.components) === 'IMAGE' ? 'IMAGE' : 'NONE',
    examples,
    buttons,
  }
}

/** O botão lido da Meta no formato de cadastro (exemplo de URL vem em lista). */
function toEditableButton(button: TemplateButton): TemplateButton {
  switch (button.type) {
    case 'QUICK_REPLY':
      return { type: 'QUICK_REPLY', text: button.text ?? '' }
    case 'URL':
      return {
        type: 'URL',
        text: button.text ?? '',
        url: button.url ?? '',
        ...(Array.isArray(button.example) && button.example.length
          ? { example: button.example.map(String) }
          : {}),
      }
    case 'PHONE_NUMBER':
      return {
        type: 'PHONE_NUMBER',
        text: button.text ?? '',
        phone_number: button.phone_number ?? '',
      }
    case 'COPY_CODE': {
      // A Meta devolve o exemplo como lista; o cadastro manda texto.
      const example: unknown = (button as { example?: unknown }).example
      const first: unknown = Array.isArray(example) ? example[0] : example
      return {
        type: 'COPY_CODE',
        example: typeof first === 'string' ? first : '',
      }
    }
  }
}
