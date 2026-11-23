import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryInsightsKv } from '@/modules/thinkzap/infra/insights/memory-insights-kv'
import { makeInsightsKeys } from './insights-keys'
import {
  clearKeyProblem,
  configureKeyHealth,
  getKeyProblem,
  markKeyRevoked,
  markKeyUnreadable,
} from './key-health'

describe('key-health', () => {
  beforeEach(async () => {
    await clearKeyProblem('app-1')
    await clearKeyProblem('app-2')
  })

  it('não tem problema por padrão', async () => {
    expect(await getKeyProblem('app-1')).toBeNull()
  })

  it('marca a chave como revogada só para o app informado', async () => {
    await markKeyRevoked('app-1')
    expect(await getKeyProblem('app-1')).toBe('revoked')
    expect(await getKeyProblem('app-2')).toBeNull()
  })

  it('marca a chave como ilegível', async () => {
    await markKeyUnreadable('app-1')
    expect(await getKeyProblem('app-1')).toBe('unreadable')
  })

  it('limpa o problema', async () => {
    await markKeyRevoked('app-1')
    await clearKeyProblem('app-1')
    expect(await getKeyProblem('app-1')).toBeNull()
  })
})

describe('key-health compartilhado entre processos', () => {
  afterEach(() => {
    // Volta ao padrão em memória para não vazar para outros testes.
    configureKeyHealth({
      kv: new MemoryInsightsKv(),
      keys: makeInsightsKeys('bull'),
    })
  })

  it('o que um processo marca o outro lê (worker marca, API mostra)', async () => {
    const shared = new MemoryInsightsKv()
    configureKeyHealth({ kv: shared, keys: makeInsightsKeys('bull') })
    await markKeyRevoked('app-1')

    // "Outro processo": configuração nova sobre o mesmo armazenamento.
    configureKeyHealth({ kv: shared, keys: makeInsightsKeys('bull') })
    expect(await getKeyProblem('app-1')).toBe('revoked')

    await clearKeyProblem('app-1')
    expect(await getKeyProblem('app-1')).toBeNull()
  })

  it('o aviso expira sozinho (era transitório quando vivia na memória)', async () => {
    let now = 0
    const kv = new MemoryInsightsKv(() => now)
    configureKeyHealth({ kv, keys: makeInsightsKeys('bull') })
    await markKeyRevoked('app-1')
    now += 6 * 3600e3 - 1
    expect(await getKeyProblem('app-1')).toBe('revoked')
    now += 2
    expect(await getKeyProblem('app-1')).toBeNull()
  })

  it('não vaza entre ambientes que dividem o Redis', async () => {
    const shared = new MemoryInsightsKv()
    configureKeyHealth({ kv: shared, keys: makeInsightsKeys('staging') })
    await markKeyRevoked('app-1')
    configureKeyHealth({ kv: shared, keys: makeInsightsKeys('bull') })
    expect(await getKeyProblem('app-1')).toBeNull()
  })
})
