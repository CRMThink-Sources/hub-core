import z from 'zod'

// Qual fluxo atende esta sessão. Os fatos são resolvidos antes, pelo chamador, para não
// haver ida ao Bitrix aqui dentro.

export type BindingFacts = {
  /** Nunca trocou mensagem nesta linha. */
  'contact.isNew': boolean
  /** Horário da linha vem do Bitrix, não do nosso relógio. */
  worktime: 'inside' | 'outside'
  weekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
  /** Hora local da linha, 0–23. */
  hour: number
  /** Sessões anteriores deste contato. */
  sessionCount: number
}

export type BindingFactName = keyof BindingFacts

const NUMERIC_FACTS: BindingFactName[] = ['hour', 'sessionCount']

export type BindingOperator = 'eq' | 'neq' | 'in' | 'gt' | 'gte' | 'lt' | 'lte'

export type BindingTest = {
  fact: BindingFactName
  op: BindingOperator
  value: string | number | boolean | Array<string | number>
}

/** Só `all` na v1. */
export type BindingCondition = {
  all: BindingTest[]
}

const bindingFactSchema = z.enum([
  'contact.isNew',
  'worktime',
  'weekday',
  'hour',
  'sessionCount',
])

const bindingTestSchema = z.object({
  fact: bindingFactSchema,
  op: z.enum(['eq', 'neq', 'in', 'gt', 'gte', 'lt', 'lte']),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number()])).min(1),
  ]),
})

export const bindingConditionSchema = z.object({
  all: z.array(bindingTestSchema).min(1).max(10),
})

/** `null` = pega o resto. Forma inválida também vira `null`. */
export function parseBindingCondition(raw: unknown): BindingCondition | null {
  if (raw == null) return null

  const parsed = bindingConditionSchema.safeParse(raw)
  return parsed.success ? (parsed.data as BindingCondition) : null
}

// `null` casa com tudo (o vínculo "pega o resto"). Teste sem sentido (`gt` sobre
// `worktime`, `in` sem lista) é falso, não exceção: o próximo da fila é avaliado em vez de
// estourar no meio do atendimento.
export function evaluateBindingCondition(
  condition: BindingCondition | null,
  facts: BindingFacts,
): boolean {
  if (!condition) return true

  return condition.all.every(test => evaluateTest(test, facts))
}

function evaluateTest(test: BindingTest, facts: BindingFacts): boolean {
  const actual = facts[test.fact]

  if (test.op === 'in') {
    return Array.isArray(test.value)
      ? test.value.some(candidate => sameValue(candidate, actual))
      : false
  }

  if (Array.isArray(test.value)) return false

  if (test.op === 'eq') return sameValue(test.value, actual)
  if (test.op === 'neq') return !sameValue(test.value, actual)

  // Comparação de ordem só existe em fato numérico.
  if (!NUMERIC_FACTS.includes(test.fact)) return false

  const expected = Number(test.value)
  const current = Number(actual)
  if (!Number.isFinite(expected) || !Number.isFinite(current)) return false

  switch (test.op) {
    case 'gt':
      return current > expected
    case 'gte':
      return current >= expected
    case 'lt':
      return current < expected
    case 'lte':
      return current <= expected
  }
}

// Compara por string para tolerar o JSON do editor: `"true"` vs `true`, `"18"` vs `18`.
function sameValue(
  expected: string | number | boolean,
  actual: string | number | boolean,
): boolean {
  return String(expected).toLowerCase() === String(actual).toLowerCase()
}

export type ResolvableBinding = {
  priority: number
  active: boolean
  condition: BindingCondition | null
}

// Primeiro vínculo ativo que casar, na ordem de prioridade. `null` = a linha atende sem
// bot, o que é resposta legítima.
//
// Hoje a lista tem sempre um item (`@@unique([appId, lineId])`), porque o Bitrix só guarda
// um `WELCOME_BOT_ID` por linha. Ordenação e condição ficam para o dia em que uma linha
// aceitar mais de um fluxo. Empate de prioridade resolve pela ordem recebida do banco.
export function resolveBinding<T extends ResolvableBinding>(
  bindings: T[],
  facts: BindingFacts,
): T | null {
  const ordered = [...bindings]
    .filter(binding => binding.active)
    .sort((left, right) => left.priority - right.priority)

  return (
    ordered.find(binding =>
      evaluateBindingCondition(binding.condition, facts),
    ) ?? null
  )
}
