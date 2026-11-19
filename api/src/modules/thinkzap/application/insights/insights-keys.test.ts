import { describe, expect, it } from 'vitest'
import {
  insightsQueryHash,
  makeInsightsKeys,
  normalizeInsightsQuery,
} from './insights-keys'

describe('insightsQueryHash', () => {
  it('não depende da ordem dos parâmetros', () => {
    expect(insightsQueryHash('dashboard', { from: 'a', to: 'b' })).toBe(
      insightsQueryHash('dashboard', { to: 'b', from: 'a' }),
    )
  })

  it('ignora filtro ausente ou em branco', () => {
    const base = { from: '2026-11-01', to: '2026-11-07' }
    expect(
      insightsQueryHash('dashboard', {
        ...base,
        dept: '',
        operator: undefined,
      }),
    ).toBe(insightsQueryHash('dashboard', base))
  })

  it('separa consultas e tipos diferentes', () => {
    const q = { from: '2026-11-01' }
    expect(insightsQueryHash('dashboard', q)).not.toBe(
      insightsQueryHash('dashboard', { from: '2026-11-02' }),
    )
    expect(insightsQueryHash('dashboard', q)).not.toBe(
      insightsQueryHash('today', q),
    )
  })

  it('gera um trecho sem dois-pontos (o BullMQ recusa jobId com ":")', () => {
    expect(insightsQueryHash('today', { sources: 'a:b' })).toMatch(
      /^[0-9a-f]{16}$/,
    )
  })

  it('normaliza igual ao cálculo de chave antigo (vazios fora, ordem fixa)', () => {
    expect(normalizeInsightsQuery({ b: 1, a: 2, c: undefined })).toBe(
      '[["a",2],["b",1]]',
    )
  })
})

describe('makeInsightsKeys', () => {
  const prod = makeInsightsKeys('bull')
  const staging = makeInsightsKeys('staging')

  it('separa por ambiente e por app', () => {
    expect(prod.result('app1', 'dashboard', 'h')).not.toBe(
      staging.result('app1', 'dashboard', 'h'),
    )
    expect(prod.result('app1', 'dashboard', 'h')).not.toBe(
      prod.result('app2', 'dashboard', 'h'),
    )
    expect(prod.day('app1', '2026-11-01')).toBe(
      'insights:bull:app1:sd:2026-11-01',
    )
  })

  it('a invalidação não alcança geração, uso recente nem problema da chave', () => {
    const patterns = prod.invalidationPatterns('app1')
    const covered = (key: string) =>
      patterns.some(p =>
        new RegExp('^' + p.replace(/\*/g, '.*') + '$').test(key),
      )
    expect(covered(prod.result('app1', 'dashboard', 'h'))).toBe(true)
    expect(covered(prod.state('app1', 'today', 'h'))).toBe(true)
    expect(covered(prod.day('app1', '2026-11-01'))).toBe(true)
    expect(covered(prod.generation('app1'))).toBe(false)
    expect(covered(prod.lastOpen('app1'))).toBe(false)
    expect(covered(prod.keyProblem('app1'))).toBe(false)
  })

  it('a invalidação de um ambiente não casa chaves de outro', () => {
    const patterns = staging.invalidationPatterns('app1')
    const key = prod.result('app1', 'dashboard', 'h')
    expect(
      patterns.some(p =>
        new RegExp('^' + p.replace(/\*/g, '.*') + '$').test(key),
      ),
    ).toBe(false)
  })

  it('lê o appId da chave de uso recente', () => {
    expect(prod.appIdFromLastOpen(prod.lastOpen('abc-123'))).toBe('abc-123')
    // Chave de outro ambiente não é lida como sendo deste.
    expect(prod.appIdFromLastOpen(staging.lastOpen('abc-123'))).toBeNull()
    expect(prod.appIdFromLastOpen('outra:chave')).toBeNull()
  })
})
