import { describe, expect, it } from 'vitest'
import { formatOutboundMessageWithOperator } from './format-outbound-message-with-operator'

describe('formatOutboundMessageWithOperator', () => {
  it('returns text unchanged when disabled', () => {
    expect(
      formatOutboundMessageWithOperator('Olá', {
        enabled: false,
        operatorName: 'João Silva',
      }),
    ).toBe('Olá')
  })

  it('prefixes text with operator name when enabled', () => {
    expect(
      formatOutboundMessageWithOperator('Olá', {
        enabled: true,
        operatorName: 'João Silva',
      }),
    ).toBe('João Silva: Olá')
  })

  it('returns text unchanged when enabled but operator name is missing', () => {
    expect(
      formatOutboundMessageWithOperator('Olá', {
        enabled: true,
        operatorName: null,
      }),
    ).toBe('Olá')
  })

  it('trims operator name before prefixing', () => {
    expect(
      formatOutboundMessageWithOperator('Olá', {
        enabled: true,
        operatorName: '  João Silva  ',
      }),
    ).toBe('João Silva: Olá')
  })
})
