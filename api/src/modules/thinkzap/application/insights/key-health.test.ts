import { beforeEach, describe, expect, it } from 'vitest'
import { clearKeyProblem, getKeyProblem, markKeyRevoked } from './key-health'

describe('key-health', () => {
  beforeEach(() => {
    clearKeyProblem('app-1')
    clearKeyProblem('app-2')
  })

  it('não tem problema por padrão', () => {
    expect(getKeyProblem('app-1')).toBeNull()
  })

  it('marca a chave como revogada só para o app informado', () => {
    markKeyRevoked('app-1')
    expect(getKeyProblem('app-1')).toBe('revoked')
    expect(getKeyProblem('app-2')).toBeNull()
  })

  it('limpa o problema', () => {
    markKeyRevoked('app-1')
    clearKeyProblem('app-1')
    expect(getKeyProblem('app-1')).toBeNull()
  })
})
