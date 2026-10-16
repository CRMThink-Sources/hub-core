import type { WidgetTemplateButton } from '@/app/hooks/use-widget-templates'
import {
  dynamicButtons,
  extractTemplateVariables,
  orderedTemplateParameters,
} from '@/app/(widgets)/layouts/template-variables'

/**
 * Um valor da configuração: **literal**, **campo do documento**, ou **expressão** que
 * veio do seletor nativo do Bitrix.
 *
 * Nos dois últimos o que fica gravado é uma expressão, e é o Bitrix que a resolve antes
 * de chamar o handler — o webhook nunca vê expressão, só o valor final. É por isso que
 * o modo não é gravado em lugar nenhum: ele é derivado de volta da própria forma do
 * valor quando a tela reabre.
 *
 * O modo `expression` existe porque o seletor nativo grava coisas que esta tela não
 * consegue oferecer — `{{{[Criar usando fonte] ID Empresa}}}` é retorno de **outro passo
 * da automação**, não campo do documento. Sem um modo próprio, esse valor reabria como
 * texto: o rótulo aparecia num input editável, convidando a estragá-lo.
 */
export type FieldValue = {
  mode: 'literal' | 'document' | 'expression'
  /**
   * Literal: o texto digitado. Documento: o **id do campo**, sem a expressão.
   * Expressão: o token do Bitrix inteiro, com as chaves, verbatim.
   */
  value: string
}

export const EMPTY_FIELD: FieldValue = { mode: 'literal', value: '' }

/**
 * A expressão de campo do documento, nas formas que o Bitrix devolve.
 *
 * Gravamos `{{=Document:UF_CRM_123}}`, a forma da automação de CRM, mas o que volta em
 * `current_values` não é necessariamente byte a byte o que foi gravado: o designer de
 * workflow usa uma chave só (`{=Document:…}`), e o portal pode devolver a expressão com
 * espaço ou com modificador (`_printable`, `> printable`) — é assim que o formulário
 * nativo pede valor legível.
 *
 * Reconhecer só a forma exata que gravamos fazia a variável reabrir em "Texto" com a
 * expressão crua no campo, e salvar de novo gravava a expressão **dentro** de outra.
 */
const DOCUMENT_EXPRESSION =
  /^\{{1,3}\s*=\s*Document\s*:\s*([A-Za-z0-9_]+?)(?:_printable)?\s*(?:>\s*[A-Za-z0-9_ ]+)?\s*\}{1,3}$/

/**
 * Token do seletor nativo do Bitrix, no formato de três chaves com rótulo legível:
 * `{{{[Hariel] ID Negócio}}}`, `{{{[Criar usando fonte] ID Empresa}}}`.
 *
 * O rótulo entre colchetes é o **passo da automação** de onde o valor vem, então o token
 * pode apontar para retorno de outro robô — coisa que esta tela não sabe produzir e não
 * deve reescrever. É guardado verbatim.
 */
const BITRIX_TOKEN = /^\{\{\{?[^{}]+\}?\}\}$/

export function toStoredValue(field: FieldValue): string {
  if (field.mode === 'literal') return field.value
  // O token do Bitrix já vem com as chaves; embrulhá-lo de novo o quebraria.
  if (field.mode === 'expression') return field.value
  return field.value ? `{{=Document:${field.value}}}` : ''
}

/** O rótulo de dentro do token, para mostrar sem as chaves. */
export function expressionLabel(value: string): string {
  return value.replace(/^\{+/, '').replace(/\}+$/, '').trim()
}

/**
 * Deriva o modo de volta da forma do valor.
 *
 * `knownFieldIds` cobre o caso do portal que devolve o campo já sem a expressão, só com
 * o id (`UF_CRM_123`): sem a lista não há como distinguir isso de texto digitado, e com
 * ela o modo volta certo. Texto que por acaso seja idêntico a um id de campo do
 * documento é o preço, e é mais raro que o caso que ele resolve.
 *
 * A ordem importa: `{{=Document:X}}` também casaria como token do seletor, e o modo
 * campo é o mais útil dos dois — dá o `select` de volta em vez de um valor intocável.
 */
export function fromStoredValue(
  raw: string | undefined,
  knownFieldIds?: ReadonlySet<string>,
): FieldValue {
  const value = raw ?? ''
  const trimmed = value.trim()
  const match = DOCUMENT_EXPRESSION.exec(trimmed)

  if (match?.[1]) return { mode: 'document', value: match[1] }
  if (BITRIX_TOKEN.test(trimmed)) return { mode: 'expression', value: trimmed }
  if (trimmed && knownFieldIds?.has(trimmed)) {
    return { mode: 'document', value: trimmed }
  }

  return { mode: 'literal', value }
}

export type TemplateChoice = {
  name: string
  language: string
  body: string
  /**
   * Só no template vindo do catálogo. O gravado no robô não guarda botões: a tela
   * os lê do catálogo carregado, e o disparo, do catálogo do provider.
   */
  buttons?: WidgetTemplateButton[]
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
  /**
   * Um valor por botão dinâmico do template, **na ordem** em que esses botões
   * aparecem. Posicional porque é o que o Bitrix guarda; o handler amarra cada valor
   * ao `index` do botão pelo catálogo.
   */
  buttonValues: FieldValue[]
}

export const EMPTY_CONFIG: RobotConfigState = {
  connector: '',
  destination: EMPTY_FIELD,
  sendToAllRelatedContacts: false,
  template: null,
  values: {},
  buttonValues: [],
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
    templateButtonParameters: config.buttonValues.map(toStoredValue),
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
  knownFieldIds?: ReadonlySet<string>,
): RobotConfigState {
  const body = asString(stored.templateBody)
  const name = asString(stored.templateName)
  const language = asString(stored.templateLanguage)

  const parameters = asStringList(stored.templateParameters)
  const keys = extractTemplateVariables(body)

  return {
    connector: asString(stored.connector),
    destination: fromStoredValue(asString(stored.destination), knownFieldIds),
    sendToAllRelatedContacts: isToggleOn(stored.sendToAllRelatedContacts),
    template: name && language ? { name, language, body } : null,
    values: Object.fromEntries(
      keys.map((key, index) => [
        key,
        fromStoredValue(parameters[index], knownFieldIds),
      ]),
    ),
    buttonValues: asStringList(stored.templateButtonParameters).map(value =>
      fromStoredValue(value, knownFieldIds),
    ),
  }
}

/**
 * O que ainda falta para a configuração poder ser salva.
 *
 * `dynamicButtonCount` vem do catálogo carregado; sem ele (catálogo ainda não
 * chegou ou falhou) os botões não são conferidos, em vez de acusar falta que pode
 * não existir.
 */
export function validateConfig(
  config: RobotConfigState,
  dynamicButtonCount?: number,
): string | null {
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

  /**
   * Botão dinâmico sem valor faria o disparo recusar em toda execução — link sem o
   * final ou cupom sem código não podem ser enviados.
   */
  if (dynamicButtonCount) {
    const filled = config.buttonValues
      .slice(0, dynamicButtonCount)
      .filter(field => toStoredValue(field).trim()).length

    if (filled < dynamicButtonCount) {
      return 'Preencha o valor de todos os botões do template.'
    }
  }

  return null
}

/**
 * Os campos dos botões dinâmicos de um template recém-escolhido. Não reaproveita
 * valores do template anterior: botão na mesma posição pode ser outro link ou um
 * cupom, e o valor antigo iria parar no lugar errado.
 */
export function rebuildButtonValues(
  buttons: WidgetTemplateButton[] | undefined,
): FieldValue[] {
  return dynamicButtons(buttons).map(() => EMPTY_FIELD)
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
