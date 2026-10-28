import { describe, expect, it } from 'vitest'

import {
  parseManualSubscriptionGraceDays,
  parseStripeSyncEnabled,
  parseSubscriptionExpirationEnabled,
  resolveStripeEnvironment,
} from './env'

/**
 * O ambiente do gateway é lido do prefixo da chave, e não de `NODE_ENV`. Estes casos
 * ficam fixos porque o custo de errar é assimétrico: resolver `homolog` quando a
 * chave é live esconde o catálogo de produção (falha fechada, visível), e resolver
 * `production` quando a chave é de teste manda um price id que a conta não conhece
 * para o checkout de um cliente.
 */
describe('resolveStripeEnvironment', () => {
  it('resolve produção para a secret key live', () => {
    expect(resolveStripeEnvironment('sk_live_abc123')).toBe('production')
  })

  it('resolve produção para a restricted key live', () => {
    /**
     * `rk_` é aceita pelo gateway — só a publicável é recusada. Tratá-la como
     * homologação faria a produção ler o price id de teste.
     */
    expect(resolveStripeEnvironment('rk_live_abc123')).toBe('production')
  })

  it('resolve homologação para a chave de teste', () => {
    expect(resolveStripeEnvironment('sk_test_abc123')).toBe('homolog')
    expect(resolveStripeEnvironment('rk_test_abc123')).toBe('homolog')
  })

  it('resolve homologação para chave ausente ou vazia', () => {
    expect(resolveStripeEnvironment('')).toBe('homolog')
    expect(resolveStripeEnvironment(undefined)).toBe('homolog')
  })

  it('resolve homologação para valor malformado', () => {
    /**
     * Inclui o caso da publicável no lugar da secret: o gateway recusa isso no
     * construtor, e até lá o ambiente fechado é o default certo.
     */
    expect(resolveStripeEnvironment('pk_live_abc123')).toBe('homolog')
    expect(resolveStripeEnvironment('sk_live')).toBe('homolog')
    expect(resolveStripeEnvironment('live_sk_abc')).toBe('homolog')
    expect(resolveStripeEnvironment('  sk_live_abc123')).toBe('homolog')
  })
})

describe('parseSubscriptionExpirationEnabled', () => {
  it('segue os efeitos de provider quando ausente', () => {
    expect(parseSubscriptionExpirationEnabled(undefined, true)).toBe(true)
    expect(parseSubscriptionExpirationEnabled(undefined, false)).toBe(false)
  })

  it('só os literais explícitos sobrescrevem', () => {
    expect(parseSubscriptionExpirationEnabled('true', false)).toBe(true)
    expect(parseSubscriptionExpirationEnabled('false', true)).toBe(false)
    expect(parseSubscriptionExpirationEnabled('', false)).toBe(false)
    expect(parseSubscriptionExpirationEnabled('yes', false)).toBe(false)
  })
})

describe('parseManualSubscriptionGraceDays', () => {
  it('ausente ou vazio é 0', () => {
    expect(parseManualSubscriptionGraceDays(undefined)).toBe(0)
    expect(parseManualSubscriptionGraceDays('')).toBe(0)
  })

  it('aceita inteiros não negativos', () => {
    expect(parseManualSubscriptionGraceDays('0')).toBe(0)
    expect(parseManualSubscriptionGraceDays('3')).toBe(3)
  })

  it('inválido vira 0', () => {
    expect(parseManualSubscriptionGraceDays('-1')).toBe(0)
    expect(parseManualSubscriptionGraceDays('abc')).toBe(0)
    expect(parseManualSubscriptionGraceDays('1.5')).toBe(0)
  })
})

describe('parseStripeSyncEnabled', () => {
  it('true e false explícitos valem sempre', () => {
    expect(parseStripeSyncEnabled('true', false, 'homolog')).toBe(true)
    expect(parseStripeSyncEnabled('false', true, 'production')).toBe(false)
  })

  it('ausente: liga só com provider ligado e chave live', () => {
    expect(parseStripeSyncEnabled(undefined, true, 'production')).toBe(true)
    expect(parseStripeSyncEnabled(undefined, true, 'homolog')).toBe(false)
    expect(parseStripeSyncEnabled(undefined, false, 'production')).toBe(false)
  })
})
