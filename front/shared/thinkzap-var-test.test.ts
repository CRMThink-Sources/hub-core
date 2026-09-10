import { describe, expect, it } from 'vitest'
import {
  VAR_OPERATORS,
  VAR_OPERATOR_LABEL,
  describeVarTest,
} from './thinkzap-bot-flow'

/**
 * Resumo da condição no cartão do canvas.
 *
 * Antes o cartão mostrava "1 condição(ões)": contava os ramos sem dizer o que nenhum
 * testa, então o bloco de decisão era o único que não deixava ler a própria decisão.
 */
describe('describeVarTest', () => {
  it('operador sem valor não escreve valor nenhum', () => {
    expect(describeVarTest({ var: 'clienteId', op: 'notEmpty' })).toBe(
      'clienteId tem',
    )
    expect(describeVarTest({ var: 'cpf', op: 'empty' })).toBe('cpf vazia')
  })

  it('operador com valor mostra os dois lados', () => {
    expect(describeVarTest({ var: 'plano', op: 'eq', value: 'ouro' })).toBe(
      'plano = ouro',
    )
  })

  it('valor ainda não preenchido não vira texto vazio', () => {
    // Sem isto o resumo terminava em "plano =" e parecia truncado.
    expect(describeVarTest({ var: 'plano', op: 'eq' })).toBe('plano = ?')
    expect(describeVarTest({ var: 'plano', op: 'contains', value: '  ' })).toBe(
      'plano contém ?',
    )
  })

  it('variável sem nome ainda se lê', () => {
    // Ramo recém-criado nasce com `var: ''`.
    expect(describeVarTest({ var: '', op: 'notEmpty' })).toBe('variável tem')
  })

  it('todo operador tem rótulo e entra na lista do editor', () => {
    // Operador novo sem rótulo apareceria como `undefined` no cartão.
    for (const op of VAR_OPERATORS) {
      expect(VAR_OPERATOR_LABEL[op]).toBeTruthy()
    }
    expect(VAR_OPERATORS).toHaveLength(Object.keys(VAR_OPERATOR_LABEL).length)
  })
})
