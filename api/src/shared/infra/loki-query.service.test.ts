import { describe, it, expect } from 'vitest'
import { buildLogQL } from './loki-query.service'

describe('buildLogQL', () => {
  it('filtra por label app e campo json domain', () => {
    const q = buildLogQL({
      appLabel: 'thinkzap',
      domain: 'cli.bitrix24.com.br',
    })
    expect(q).toBe(
      '{app="thinkzap"} != "HTTP request completed" | json | domain="cli.bitrix24.com.br"',
    )
  })

  it('adiciona line filter quando há search', () => {
    const q = buildLogQL({
      appLabel: 'clicksign',
      domain: 'x.bitrix24.com.br',
      search: 'erro',
    })
    expect(q).toBe(
      '{app="clicksign"} != "HTTP request completed" | json | domain="x.bitrix24.com.br" |= "erro"',
    )
  })

  it('ignora search vazio/whitespace', () => {
    const q = buildLogQL({
      appLabel: 'importsheet',
      domain: 'x.bitrix24.com.br',
      search: '   ',
    })
    expect(q).not.toContain('|=')
  })

  it('escapa aspas e backslash no domain e no search (anti-injeção)', () => {
    const q = buildLogQL({
      appLabel: 'thinkanalise',
      domain: 'a"b\\c',
      search: 'x"y',
    })
    expect(q).toContain('domain="a\\"b\\\\c"')
    expect(q).toContain('|= "x\\"y"')
  })
})
