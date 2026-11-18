import type { ComboboxOption } from '@/components/ui/combobox'
import type {
  CrmField,
  CrmFieldSource,
  TemplateVariableMappings,
} from '@/app/hooks/use-connector-templates'
import type { ConnectorTemplate } from '@/app/hooks/use-connector-templates'
import { extractTemplateVariables } from '@/app/(widgets)/layouts/template-variables'
import { componentText } from './template-view'

/**
 * Variáveis do corpo do template, na ordem em que aparecem — as mesmas que o widget
 * gera como campos, porque as duas pontas usam a mesma extração.
 */
export function templateVariablesOf(
  template: Pick<ConnectorTemplate, 'components'>,
): string[] {
  return extractTemplateVariables(componentText(template.components, 'BODY'))
}

/** A ação "Variáveis padrão" só faz sentido com ao menos uma variável no corpo. */
export function hasTemplateVariables(
  template: Pick<ConnectorTemplate, 'components'>,
): boolean {
  return templateVariablesOf(template).length > 0
}

/** Valor do item do seletor: origem + campo, para o mesmo `id` não colidir. */
export function fieldOptionValue(source: CrmFieldSource, fieldId: string) {
  return `${source}:${fieldId}`
}

/**
 * Itens do seletor de campo. Campo de registro vinculado leva a origem no rótulo
 * ("Contato › Nome"); o personalizado, uma legenda, que é onde o operador confere
 * que pegou o campo certo quando há títulos repetidos.
 */
export function fieldOptions(
  fields: CrmField[],
  labels: { sourceLabel: (source: CrmFieldSource) => string; custom: string },
): ComboboxOption[] {
  return fields.map(field => ({
    value: fieldOptionValue(field.source, field.id),
    label:
      field.source === 'self'
        ? field.title
        : `${labels.sourceLabel(field.source)} › ${field.title}`,
    ...(field.custom ? { description: labels.custom } : {}),
  }))
}

/** `{ '1': 'contact:name' }` — a escolha por variável, no valor do seletor. */
export type VariableSelection = Record<string, string>

export function selectionFromMappings(
  mappings: TemplateVariableMappings,
): VariableSelection {
  const selection: VariableSelection = {}
  for (const [variable, ref] of Object.entries(mappings)) {
    selection[variable] = fieldOptionValue(ref.source, ref.fieldId)
  }
  return selection
}

/**
 * O que a API recebe. Variável sem escolha fica de fora — "sem campo" é ausência, e
 * a API apaga o mapeamento se nada sobrar.
 */
export function mappingsFromSelection(
  variables: string[],
  selection: VariableSelection,
): TemplateVariableMappings {
  const mappings: TemplateVariableMappings = {}
  for (const variable of variables) {
    const value = selection[variable]
    if (!value) continue
    const separator = value.indexOf(':')
    const source = value.slice(0, separator) as CrmFieldSource
    const fieldId = value.slice(separator + 1)
    if (separator > 0 && fieldId) mappings[variable] = { source, fieldId }
  }
  return mappings
}

/**
 * Escolha que aponta para um campo que a entidade já não tem (apagado no Bitrix):
 * o diálogo marca a variável em vez de mostrar um seletor vazio sem explicação.
 */
export function missingFieldVariables(
  selection: VariableSelection,
  fields: CrmField[],
): string[] {
  const known = new Set(fields.map(f => fieldOptionValue(f.source, f.id)))
  return Object.entries(selection)
    .filter(([, value]) => value && !known.has(value))
    .map(([variable]) => variable)
}
