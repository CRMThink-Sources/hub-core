/**
 * Por que um destino que o Bitrix entregou ao robô não virou telefone.
 *
 * A expressão de campo é resolvida pelo Bitrix **antes** de chamar o webhook, então o
 * servidor só vê o resultado. Dois resultados parecem iguais para o operador ("nenhum
 * destinatário válido") e têm causas e consertos diferentes:
 *
 * - `empty`: o campo foi resolvido para vazio. O Bitrix deixa o par de chaves de fora da
 *   expressão, então o vazio chega como `{}`. Costuma ser contato sem telefone **do tipo**
 *   que o campo lê (um número cadastrado como "Trabalho" não aparece em "Celular").
 * - `unresolved-token`: o Bitrix não resolveu e entregou o texto cru, como
 *   `{{{Contato: Celular}}}`. É o valor gravado na forma de exibição, que ele não
 *   resolve; o conserto é reabrir o robô, escolher o campo de novo e salvar.
 *
 * Telefone mal formado (`1234`) é `other`: continua sendo "nenhum destinatário válido".
 */
export type RobotDestinationKind = 'empty' | 'unresolved-token' | 'other'

/** Duas ou três chaves em volta de um rótulo: `{{Campo}}` ou `{{{Campo}}}`. */
const UNRESOLVED_TOKEN = /\{{2,3}[^{}]+\}{2,3}/

export function classifyRobotDestination(value: string): RobotDestinationKind {
  // Só chaves e espaços não é destino: é o rastro de uma expressão que resolveu a vazio.
  if (value.replace(/[\s{}]/g, '') === '') return 'empty'

  if (UNRESOLVED_TOKEN.test(value)) return 'unresolved-token'

  return 'other'
}

export type RobotDestinationDiagnosis = {
  kind: 'empty' | 'unresolved-token'
  /** O destino que motivou o diagnóstico, como chegou. */
  value: string
}

/**
 * O diagnóstico de um envio em que **nenhum** destinatário foi aceito.
 *
 * Token não resolvido ganha de vazio: é o mais específico e o único com conserto na
 * própria configuração do robô. `null` quando nenhum dos destinos explica a recusa, e
 * quem chama mantém o aviso genérico.
 */
export function diagnoseFailedDestinations(
  destinations: readonly string[],
): RobotDestinationDiagnosis | null {
  const classified = destinations.map(value => ({
    value,
    kind: classifyRobotDestination(value),
  }))

  const token = classified.find(item => item.kind === 'unresolved-token')
  if (token) return { kind: 'unresolved-token', value: token.value }

  const empty = classified.find(item => item.kind === 'empty')
  if (empty) return { kind: 'empty', value: empty.value }

  return null
}
