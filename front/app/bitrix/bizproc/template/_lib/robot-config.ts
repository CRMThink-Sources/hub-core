import {
  extractTemplateVariables,
  orderedTemplateParameters,
} from '@/app/(widgets)/layouts/template-variables'

/**
 * Um valor da configuração pode ser **literal** ou **campo do documento**.
 *
 * No modo campo o que fica gravado é a expressão do Bitrix, e é o Bitrix que a
 * resolve antes de chamar o handler — o webhook nunca vê expressão, só o valor final.
 * É por isso que o modo não é gravado em lugar nenhum: ele é derivado de volta da
 * própria forma do valor quando a tela reabre.
 */
export type FieldValue = {
  mode: 'literal' | 'document'
  /** Literal: o texto digitado. Documento: o **id do campo**, sem a expressão. */
  value: string
}

export const EMPTY_FIELD: FieldValue = { mode: 'literal', value: '' }

/** `{{=Document:UF_CRM_123}}` — a mesma forma que o formulário nativo grava. */
const DOCUMENT_EXPRESSION = /^\{\{=Document:([A-Za-z0-9_]+)\}\}$/

export function toStoredValue(field: FieldValue): string {
  if (field.mode === 'literal') return field.value
  return field.value ? `{{=Document:${field.value}}}` : ''
}

export function fromStoredValue(raw: string | undefined): FieldValue {
  const value = raw ?? ''
  const match = DOCUMENT_EXPRESSION.exec(value.trim())

  return match?.[1]
    ? { mode: 'document', value: match[1] }
    : { mode: 'literal', value }
}

export type TemplateChoice = {
  name: string
  language: string
  body: string
}

/** Identidade do template: `name` sozinho não basta, a mesma WABA repete idiomas. */
export const templateKey = (template: {
  name: string
  language: string
}): string => `${template.name}|${template.language}`

export type RobotConfigState = {
  /** Id do item de assinatura — a linha. */
  connector: string
  destination: FieldValue
  sendToAllRelatedContacts: boolean
  template: TemplateChoice | null
  /** Um valor por variável distinta do corpo, keyed pela chave do placeholder. */
  values: Record<string, FieldValue>
}

export const EMPTY_CONFIG: RobotConfigState = {
  connector: '',
  destination: EMPTY_FIELD,
  sendToAllRelatedContacts: false,
  template: null,
  values: {},
}

/**
 * As propriedades a gravar, no formato que `setPropertyValue` espera.
 *
 * `templateParameters` sai **posicional**, na ordem das variáveis distintas do corpo —
 * a mesma ordem que `resolveTemplateBody` usa do outro lado para remontar o texto. É o
 * único ponto onde as duas metades precisam concordar, e concordam por reusarem
 * `template-variables.ts`.
 *
 * `templateBody` vai junto de propósito: é ele que evita uma consulta ao catálogo por
 * execução de workflow.
 */
export function buildRobotProperties(
  config: RobotConfigState,
): Record<string, string | string[]> {
  const body = config.template?.body ?? ''

  return {
    connector: config.connector,
    destination: toStoredValue(config.destination),
    sendToAllRelatedContacts: config.sendToAllRelatedContacts ? 'Y' : 'N',
    templateName: config.template?.name ?? '',
    templateLanguage: config.template?.language ?? '',
    templateBody: body,
    templateParameters: orderedTemplateParameters(
      body,
      Object.fromEntries(
        Object.entries(config.values).map(([key, field]) => [
          key,
          toStoredValue(field),
        ]),
      ),
    ),
  }
}

/**
 * Recompõe o estado da tela a partir do que já estava gravado.
 *
 * `templateParameters` volta posicional, então as chaves vêm do corpo gravado — sem
 * ele não há como saber qual valor pertence a qual variável, e a tela recomeça com os
 * campos vazios em vez de casar valores na ordem errada.
 */
export function parseStoredProperties(
  stored: Record<string, unknown>,
): RobotConfigState {
  const body = asString(stored.templateBody)
  const name = asString(stored.templateName)
  const language = asString(stored.templateLanguage)

  const parameters = asStringList(stored.templateParameters)
  const keys = extractTemplateVariables(body)

  return {
    connector: asString(stored.connector),
    destination: fromStoredValue(asString(stored.destination)),
    sendToAllRelatedContacts: isToggleOn(stored.sendToAllRelatedContacts),
    template: name && language ? { name, language, body } : null,
    values: Object.fromEntries(
      keys.map((key, index) => [key, fromStoredValue(parameters[index])]),
    ),
  }
}

/** O que ainda falta para a configuração poder ser salva. */
export function validateConfig(config: RobotConfigState): string | null {
  if (!config.connector) {
    return 'Escolha a linha do WhatsApp Oficial que vai enviar.'
  }

  if (!config.template) {
    return 'Escolha o template aprovado que será enviado.'
  }

  /**
   * Destino vazio com a alternância desligada é uma automação que nunca envia — e o
   * disparo recusaria em silêncio, na timeline da entidade, longe daqui.
   */
  if (
    !config.sendToAllRelatedContacts &&
    !toStoredValue(config.destination).trim()
  ) {
    return 'Informe o destino, ou ligue o envio para todos os contatos relacionados.'
  }

  return null
}

/**
 * As variáveis do template escolhido, preservando o que já estava preenchido.
 *
 * Trocar de template reconstrói os campos; uma variável de mesmo nome no template novo
 * mantém o valor, porque perder o que o usuário digitou por causa de uma troca de
 * idioma seria gratuito.
 */
export function rebuildValues(
  body: string,
  previous: Record<string, FieldValue>,
): Record<string, FieldValue> {
  return Object.fromEntries(
    extractTemplateVariables(body).map(key => [
      key,
      previous[key] ?? EMPTY_FIELD,
    ]),
  )
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Propriedade múltipla do Bitrix chega como array, como objeto indexado, ou como
 * string quando tem um valor só. As três viram a mesma lista posicional.
 */
function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return (value as unknown[]).map(asParameterText)
  if (typeof value === 'string') return value ? [value] : []

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, item]) => asParameterText(item))
  }

  return []
}

/** Só primitivo vira texto: valor aninhado viraria `[object Object]` num campo. */
function asParameterText(item: unknown): string {
  if (typeof item === 'string') return item
  if (typeof item === 'number' || typeof item === 'boolean') return String(item)

  return ''
}

function isToggleOn(value: unknown): boolean {
  if (value === true) return true
  if (typeof value !== 'string') return false

  const normalized = value.trim().toUpperCase()
  return normalized === 'Y' || normalized === '1' || normalized === 'YES'
}
