import { describe, expect, it, vi } from 'vitest'

import {
  PLAN_SCAN_PATTERNS,
  SUBSCRIPTIONS_BY_APLICATION_SCAN_PATTERN,
  SUBSCRIPTION_SCAN_PATTERNS,
  planKey,
  planListKey,
  subscriptionItemKey,
  subscriptionKey,
  subscriptionListKey,
  subscriptionsByAplicationKey,
} from './keys'

const stripeEnvironment = { value: 'production' as 'production' | 'homolog' }

vi.mock('@/config/env', () => ({
  env: {
    payments: {
      stripe: {
        get environment() {
          return stripeEnvironment.value
        },
      },
    },
  },
}))

const inEnvironment = <T>(
  environment: 'production' | 'homolog',
  read: () => T,
): T => {
  stripeEnvironment.value = environment
  const value = read()
  stripeEnvironment.value = 'production'
  return value
}

/** Casa um padrão de `SCAN` do Redis contra uma chave. `*` cobre `:`. */
const matches = (pattern: string, key: string): boolean =>
  new RegExp(`^${pattern.split('*').map(escapeRegex).join('.*')}$`).test(key)

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * O ambiente do gateway entra na chave das famílias que carregam price id porque as
 * chaves de aplicação não têm prefixo de ambiente e dois ambientes podem dividir o
 * mesmo Redis e o mesmo índice de DB. Produção e homologação leem a **mesma** SPA de
 * planos — o portal Bitrix é o mesmo — e o que difere é exatamente o price id.
 */
describe('escopo de ambiente nas chaves de cache', () => {
  it('plano tem chave distinta por ambiente', () => {
    const producao = inEnvironment('production', () => planKey('5'))
    const homolog = inEnvironment('homolog', () => planKey('5'))

    expect(producao).not.toBe(homolog)
    expect(producao).toContain(':production:')
    expect(homolog).toContain(':homolog:')
  })

  it('listagem de planos tem chave distinta por ambiente', () => {
    expect(inEnvironment('production', planListKey)).not.toBe(
      inEnvironment('homolog', planListKey),
    )
  })

  /**
   * A entrada de assinatura embute o plano, logo embute o price id. Servir à produção
   * a entrada gravada pela homologação traria `plan.gatewayId` ausente — e é da
   * ausência de price id que `isTrialSubscription` deriva "é trial", então a
   * assinatura paga passaria por trial e a linha ficaria de graça.
   */
  it('assinatura tem chave distinta por ambiente, nas três formas', () => {
    expect(inEnvironment('production', () => subscriptionKey('42'))).not.toBe(
      inEnvironment('homolog', () => subscriptionKey('42')),
    )
    expect(inEnvironment('production', subscriptionListKey)).not.toBe(
      inEnvironment('homolog', subscriptionListKey),
    )
    expect(
      inEnvironment('production', () => subscriptionsByAplicationKey('7')),
    ).not.toBe(
      inEnvironment('homolog', () => subscriptionsByAplicationKey('7')),
    )
  })

  /**
   * Item de assinatura não carrega price id — não aninha plano, `subscription` é só o
   * id do pai —, então escopá-lo seria invalidação a mais sem nada a proteger.
   */
  it('item de assinatura não é escopado por ambiente', () => {
    expect(inEnvironment('production', () => subscriptionItemKey('9'))).toBe(
      inEnvironment('homolog', () => subscriptionItemKey('9')),
    )
  })
})

/**
 * Varredura que não casa nada não dá erro — dá cache velho servido. Estes casos
 * existem para que o dia em que a chave ganhar outro segmento apareça como teste
 * vermelho, e não como invalidação silenciosamente inócua.
 */
describe('padrões de SCAN alcançam as chaves dos dois ambientes', () => {
  it('plano', () => {
    for (const environment of ['production', 'homolog'] as const) {
      const chaves = [
        inEnvironment(environment, () => planKey('5')),
        inEnvironment(environment, planListKey),
      ]

      for (const chave of chaves) {
        expect(PLAN_SCAN_PATTERNS.some(p => matches(p, chave))).toBe(true)
      }
    }
  })

  it('assinatura', () => {
    for (const environment of ['production', 'homolog'] as const) {
      const chaves = [
        inEnvironment(environment, () => subscriptionKey('42')),
        inEnvironment(environment, subscriptionListKey),
        inEnvironment(environment, () => subscriptionsByAplicationKey('7')),
      ]

      for (const chave of chaves) {
        expect(SUBSCRIPTION_SCAN_PATTERNS.some(p => matches(p, chave))).toBe(
          true,
        )
      }
    }
  })

  it('listagens por aplicação, sem alcançar a listagem geral', () => {
    for (const environment of ['production', 'homolog'] as const) {
      const porAplicacao = inEnvironment(environment, () =>
        subscriptionsByAplicationKey('7'),
      )
      const geral = inEnvironment(environment, subscriptionListKey)

      expect(
        matches(SUBSCRIPTIONS_BY_APLICATION_SCAN_PATTERN, porAplicacao),
      ).toBe(true)
      expect(matches(SUBSCRIPTIONS_BY_APLICATION_SCAN_PATTERN, geral)).toBe(
        false,
      )
    }
  })

  it('a família de assinatura não alcança a de item', () => {
    const item = subscriptionItemKey('9')

    expect(SUBSCRIPTION_SCAN_PATTERNS.some(p => matches(p, item))).toBe(false)
  })
})
