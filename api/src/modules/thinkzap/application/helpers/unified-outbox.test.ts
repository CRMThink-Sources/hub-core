import { describe, expect, it } from 'vitest'
import { isUnifiedOutboxEnabled } from './unified-outbox'

describe('isUnifiedOutboxEnabled', () => {
  it('vazio desliga para todos', () => {
    expect(isUnifiedOutboxEnabled('m-1', '')).toBe(false)
  })

  it('lista liga só quem está nela', () => {
    expect(isUnifiedOutboxEnabled('m-1', 'm-0, m-1')).toBe(true)
    expect(isUnifiedOutboxEnabled('m-2', 'm-0, m-1')).toBe(false)
  })

  it('* liga para todos', () => {
    expect(isUnifiedOutboxEnabled('qualquer', '*')).toBe(true)
    expect(isUnifiedOutboxEnabled(null, 'm-0,*')).toBe(true)
  })

  it('sem memberId e sem * fica desligado', () => {
    expect(isUnifiedOutboxEnabled(undefined, 'm-0')).toBe(false)
  })
})
