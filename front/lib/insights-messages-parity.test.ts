import { describe, expect, it } from 'vitest'
import pt from '@/messages/pt/thinkzap/insights.json'
import en from '@/messages/en/thinkzap/insights.json'
import es from '@/messages/es/thinkzap/insights.json'
import ptAside from '@/messages/pt/thinkzap/aside.json'
import enAside from '@/messages/en/thinkzap/aside.json'
import esAside from '@/messages/es/thinkzap/aside.json'

const leafKeys = (node: unknown, prefix = ''): string[] =>
  node && typeof node === 'object'
    ? Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
        leafKeys(value, prefix ? `${prefix}.${key}` : key),
      )
    : [prefix]

/**
 * Chave que existe num idioma e falta no outro aparece crua (o próprio nome
 * da chave) na tela de quem usa aquele idioma.
 */
describe('mensagens do Insights', () => {
  it('pt, en e es têm as mesmas chaves', () => {
    const keys = leafKeys(pt).sort()
    expect(leafKeys(en).sort()).toEqual(keys)
    expect(leafKeys(es).sort()).toEqual(keys)
  })

  it('o aviso do modo enxuto em pt é o texto combinado', () => {
    expect(pt.lean.banner).toBe(
      'Versão enxuta — configure a chave Vibecode em Administração para ver tudo',
    )
  })

  it('o item de menu existe nos três idiomas', () => {
    expect(ptAside.insights).toBeTruthy()
    expect(enAside.insights).toBeTruthy()
    expect(esAside.insights).toBeTruthy()
  })
})
