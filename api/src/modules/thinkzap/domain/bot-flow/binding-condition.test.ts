import { describe, expect, it } from 'vitest'
import {
  type BindingCondition,
  type BindingFacts,
  evaluateBindingCondition,
  parseBindingCondition,
  resolveBinding,
} from './binding-condition'

const facts = (patch: Partial<BindingFacts> = {}): BindingFacts => ({
  'contact.isNew': false,
  worktime: 'inside',
  weekday: 'wed',
  hour: 14,
  sessionCount: 3,
  ...patch,
})

describe('evaluateBindingCondition', () => {
  it('condição ausente pega o resto', () => {
    expect(evaluateBindingCondition(null, facts())).toBe(true)
  })

  it('exige todos os testes', () => {
    const condition: BindingCondition = {
      all: [
        { fact: 'worktime', op: 'eq', value: 'outside' },
        { fact: 'contact.isNew', op: 'eq', value: true },
      ],
    }

    expect(
      evaluateBindingCondition(
        condition,
        facts({ worktime: 'outside', 'contact.isNew': true }),
      ),
    ).toBe(true)
    expect(
      evaluateBindingCondition(condition, facts({ worktime: 'outside' })),
    ).toBe(false)
  })

  it('compara booleano gravado como string pelo editor', () => {
    expect(
      evaluateBindingCondition(
        { all: [{ fact: 'contact.isNew', op: 'eq', value: 'true' }] },
        facts({ 'contact.isNew': true }),
      ),
    ).toBe(true)
  })

  it('in casa contra lista', () => {
    expect(
      evaluateBindingCondition(
        { all: [{ fact: 'weekday', op: 'in', value: ['sat', 'sun'] }] },
        facts({ weekday: 'sun' }),
      ),
    ).toBe(true)
  })

  it('in sem lista é falso, não exceção', () => {
    expect(
      evaluateBindingCondition(
        { all: [{ fact: 'weekday', op: 'in', value: 'sun' }] },
        facts({ weekday: 'sun' }),
      ),
    ).toBe(false)
  })

  it('compara ordem em fato numérico', () => {
    expect(
      evaluateBindingCondition(
        { all: [{ fact: 'hour', op: 'gte', value: 18 }] },
        facts({ hour: 22 }),
      ),
    ).toBe(true)
    expect(
      evaluateBindingCondition(
        { all: [{ fact: 'sessionCount', op: 'lt', value: 1 }] },
        facts({ sessionCount: 0 }),
      ),
    ).toBe(true)
  })

  it('ordem sobre fato não numérico é falso', () => {
    expect(
      evaluateBindingCondition(
        { all: [{ fact: 'worktime', op: 'gt', value: 'inside' }] },
        facts(),
      ),
    ).toBe(false)
  })
})

describe('parseBindingCondition', () => {
  it('nulo é catch-all', () => {
    expect(parseBindingCondition(null)).toBeNull()
  })

  it('fato desconhecido não vira condição', () => {
    expect(
      parseBindingCondition({
        all: [{ fact: 'lua.cheia', op: 'eq', value: 'sim' }],
      }),
    ).toBeNull()
  })

  it('lista vazia de testes não vira condição', () => {
    expect(parseBindingCondition({ all: [] })).toBeNull()
  })
})

describe('resolveBinding', () => {
  const bindings = [
    {
      id: 'plantao',
      priority: 1,
      active: true,
      condition: {
        all: [
          { fact: 'worktime' as const, op: 'eq' as const, value: 'outside' },
        ],
      },
    },
    {
      id: 'primeiro-contato',
      priority: 2,
      active: true,
      condition: {
        all: [
          { fact: 'contact.isNew' as const, op: 'eq' as const, value: true },
        ],
      },
    },
    { id: 'padrao', priority: 3, active: true, condition: null },
  ]

  it('o primeiro que casa na ordem de prioridade ganha', () => {
    const hit = resolveBinding(
      bindings,
      facts({ worktime: 'outside', 'contact.isNew': true }),
    )

    expect(hit?.id).toBe('plantao')
  })

  it('pula quem não casa e cai no seguinte', () => {
    expect(resolveBinding(bindings, facts({ 'contact.isNew': true }))?.id).toBe(
      'primeiro-contato',
    )
  })

  it('sem nenhum match específico, o catch-all atende', () => {
    expect(resolveBinding(bindings, facts())?.id).toBe('padrao')
  })

  it('ordena por prioridade, não pela ordem recebida', () => {
    const shuffled = [bindings[2]!, bindings[0]!, bindings[1]!]

    expect(resolveBinding(shuffled, facts({ worktime: 'outside' }))?.id).toBe(
      'plantao',
    )
  })

  it('vínculo inativo não concorre', () => {
    const inactive = bindings.map(binding =>
      binding.id === 'plantao' ? { ...binding, active: false } : binding,
    )

    expect(resolveBinding(inactive, facts({ worktime: 'outside' }))?.id).toBe(
      'padrao',
    )
  })

  it('sem catch-all e sem match, a linha atende sem bot', () => {
    const withoutFallback = bindings.filter(binding => binding.id !== 'padrao')

    expect(resolveBinding(withoutFallback, facts())).toBeNull()
  })
})
