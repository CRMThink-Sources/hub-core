/**
 * Estado da configuração dos dois robôs de botão (oficial e não oficial).
 *
 * Vive fora das duas pastas de robô, de propósito: as duas telas compartilham
 * o formato inteiro da configuração — só o `allowedTypes` (quais tipos de
 * botão a tela oferece) e a rota de linhas divergem entre elas. Reaproveita
 * `FieldValue`/`toStoredValue`/`fromStoredValue`/`EMPTY_FIELD` do robô de
 * template: são genéricos (não fazem nenhuma menção a template) e reescrevê-
 * los aqui duplicaria o parser de expressão do Bitrix.
 */
import {
  EMPTY_FIELD,
  fromStoredValue,
  toStoredValue,
  type FieldValue,
} from '../template/_lib/robot-config'

export type ButtonType = 'REPLY' | 'URL' | 'CALL'

export type ButtonEntry = {
  /** Só chave de lista no React — não é persistido; o backend deriva o dele pela posição. */
  id: string
  label: string
  type: ButtonType
  /** URL para `type: 'URL'`, telefone para `type: 'CALL'`. Vazio para `REPLY`. */
  value: string
}

export type ButtonRobotConfigState = {
  /** Id do item de assinatura — a linha. */
  connector: string
  destination: FieldValue
  sendToAllRelatedContacts: boolean
  body: string
  header: string
  footer: string
  buttons: ButtonEntry[]
}

export const EMPTY_BUTTON_CONFIG: ButtonRobotConfigState = {
  connector: '',
  destination: EMPTY_FIELD,
  sendToAllRelatedContacts: false,
  body: '',
  header: '',
  footer: '',
  buttons: [],
}

/**
 * Teto de botões por envio para qualquer tipo sem limite próprio em
 * `maxButtonsByType` — espelha `MAX_BUTTONS_PER_SEND` do backend, que recusa
 * o disparo acima disso.
 */
export const MAX_ROBOT_BUTTONS = 5

let nextEntryId = 1

/** Só para a key do React na lista — o backend não recebe este id. */
export function newButtonEntry(type: ButtonType): ButtonEntry {
  return { id: `new-${nextEntryId++}`, label: '', type, value: '' }
}

/**
 * As propriedades a gravar, no formato que `setPropertyValue` espera.
 *
 * `buttons` sai como propriedade múltipla, uma entrada por botão, no formato
 * `"tipo|label|url-ou-telefone"` — é o mesmo formato que
 * `parseButtonList` (backend) desmonta. Bitrix só grava lista de escalares
 * numa propriedade múltipla; não há como gravar um botão como objeto.
 */
export function buildButtonRobotProperties(
  config: ButtonRobotConfigState,
): Record<string, string | string[]> {
  return {
    connector: config.connector,
    destination: toStoredValue(config.destination),
    sendToAllRelatedContacts: config.sendToAllRelatedContacts ? 'Y' : 'N',
    body: config.body,
    header: config.header,
    footer: config.footer,
    buttons: config.buttons.map(
      button => `${button.type}|${button.label}|${button.value}`,
    ),
  }
}

/**
 * Recompõe o estado da tela a partir do que já estava gravado.
 *
 * O `id` de cada botão nasce da posição na lista: é só chave do React, o
 * backend não lê nem espera um `id` na propriedade.
 */
export function parseStoredButtonProperties(
  stored: Record<string, unknown>,
  knownFieldIds?: ReadonlySet<string>,
): ButtonRobotConfigState {
  return {
    connector: asString(stored.connector),
    destination: fromStoredValue(asString(stored.destination), knownFieldIds),
    sendToAllRelatedContacts: isToggleOn(stored.sendToAllRelatedContacts),
    body: asString(stored.body),
    header: asString(stored.header),
    footer: asString(stored.footer),
    buttons: asStringList(stored.buttons)
      .map(parseButtonEntry)
      .filter((button): button is ButtonEntry => button !== null),
  }
}

function parseButtonEntry(raw: string, index: number): ButtonEntry | null {
  const [rawType, rawLabel, rawValue] = raw.split('|')
  const type = rawType?.trim().toUpperCase()

  if (type !== 'REPLY' && type !== 'URL' && type !== 'CALL') return null

  return {
    id: String(index + 1),
    label: rawLabel?.trim() ?? '',
    type,
    value: rawValue?.trim() ?? '',
  }
}

/**
 * O que ainda falta para a configuração poder ser salva.
 *
 * `allowedTypes` vem da tela: o robô oficial oferece `URL` e `REPLY` (nunca
 * juntos — rotas diferentes da API da HubMessage), o não oficial os três,
 * com combinação restrita — só ele pode misturar `URL`/`CALL`. `maxButtonsByType`
 * só o oficial define: a Cloud API da Meta aceita um único botão `URL` mas até
 * 3 `REPLY` por mensagem de sessão livre — confirmado contra a API real em
 * 2026-09-15 (URL) e 2026-09-18 (REPLY). Tipo sem limite próprio cai em
 * `MAX_ROBOT_BUTTONS`.
 */
export function validateButtonConfig(
  config: ButtonRobotConfigState,
  allowedTypes: ButtonType[],
  maxButtonsByType?: Partial<Record<ButtonType, number>>,
): string | null {
  if (!config.connector) {
    return 'Escolha a linha que vai enviar.'
  }

  if (!config.body.trim()) {
    return 'Escreva o corpo da mensagem.'
  }

  if (config.buttons.length === 0) {
    return 'Adicione ao menos um botão.'
  }

  const currentType = config.buttons[0]?.type
  const maxButtons =
    (currentType ? maxButtonsByType?.[currentType] : undefined) ??
    MAX_ROBOT_BUTTONS
  if (config.buttons.length > maxButtons) {
    return `Esta linha aceita no máximo ${maxButtons} botão(ões) por envio.`
  }

  const invalidType = config.buttons.find(
    button => !allowedTypes.includes(button.type),
  )
  if (invalidType) {
    return `Esta linha não aceita botão do tipo "${invalidType.type}".`
  }

  const hasReply = config.buttons.some(button => button.type === 'REPLY')
  const hasOther = config.buttons.some(button => button.type !== 'REPLY')
  if (hasReply && hasOther) {
    return 'Não é possível combinar botão de resposta rápida com link/ligação no mesmo envio.'
  }

  const missingLabel = config.buttons.find(button => !button.label.trim())
  if (missingLabel) {
    return 'Preencha o texto de todos os botões.'
  }

  const missingUrl = config.buttons.find(
    button => button.type === 'URL' && !button.value.trim(),
  )
  if (missingUrl) {
    return 'Preencha o link de todos os botões de link.'
  }

  const missingPhone = config.buttons.find(
    button => button.type === 'CALL' && !button.value.trim(),
  )
  if (missingPhone) {
    return 'Preencha o telefone de todos os botões de ligação.'
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

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Propriedade múltipla do Bitrix chega como array, como objeto indexado, ou
 * como string quando tem um valor só. As três viram a mesma lista posicional.
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
