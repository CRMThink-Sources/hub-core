import { describe, expect, it } from 'vitest'
import { resolveFailureTab } from './failures-tab'

describe('resolveFailureTab', () => {
  it('?tab=inbound abre a aba Recebimento', () => {
    expect(resolveFailureTab('inbound')).toBe('inbound')
  })

  it('sem parâmetro ou com valor desconhecido cai em Envio, a aba que já existia', () => {
    expect(resolveFailureTab(null)).toBe('outbox')
    expect(resolveFailureTab('')).toBe('outbox')
    expect(resolveFailureTab('outbox')).toBe('outbox')
    expect(resolveFailureTab('qualquer-coisa')).toBe('outbox')
  })
})
