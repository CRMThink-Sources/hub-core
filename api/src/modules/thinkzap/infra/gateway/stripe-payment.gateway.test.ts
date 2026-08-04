import { describe, expect, it, vi } from 'vitest'
import {
  StripeNotConfiguredError,
  StripePaymentGateway,
  StripeWrongKeyTypeError,
} from './stripe-payment.gateway'

vi.mock('stripe', () => ({
  default: class {
    constructor(readonly key: string) {}
  },
}))

/**
 * O logger é dublado, não o `env`: dublar `env` exigiria reproduzir o que o logger
 * lê dele (nível, destino), e o teste passaria a depender daquele formato. As chaves
 * chegam por argumento em todos os casos abaixo, então o `env` real não é consultado.
 */
vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

/**
 * Só a validação de chave do construtor. As chamadas ao gateway não são exercitadas
 * aqui: dependem da API do Stripe, e o valor deste teste é impedir que chave do tipo
 * errado passe por "configurado".
 */
describe('StripePaymentGateway — chave do servidor', () => {
  it('aceita secret key', () => {
    expect(
      () => new StripePaymentGateway('sk_test_123', 'whsec_1'),
    ).not.toThrow()
  })

  it('aceita chave restrita', () => {
    expect(
      () => new StripePaymentGateway('rk_test_123', 'whsec_1'),
    ).not.toThrow()
  })

  /**
   * O erro real: a publicável foi para `STRIPE_SECRET_KEY`. Comprimento não distingue
   * — `pk_test_…` e `sk_test_…` têm o mesmo tamanho — então sem esta checagem ela
   * passa e o Stripe recusa no meio de uma contratação.
   */
  it('recusa a chave publicável', () => {
    expect(() => new StripePaymentGateway('pk_test_123', 'whsec_1')).toThrow(
      StripeWrongKeyTypeError,
    )
  })

  it('a mensagem aponta a variável certa para a publicável', () => {
    expect(() => new StripePaymentGateway('pk_test_123', 'whsec_1')).toThrow(
      /NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY/,
    )
  })

  /** Credencial não vai para log nem para mensagem de erro. */
  it('não vaza a chave na mensagem', () => {
    try {
      new StripePaymentGateway('pk_test_segredo_que_nao_pode_aparecer', 'w')
      expect.unreachable('deveria ter lançado')
    } catch (error) {
      expect((error as Error).message).not.toContain('segredo_que_nao_pode')
      expect((error as Error).message).toContain('pk_')
    }
  })

  it('recusa chave vazia antes de checar o tipo', () => {
    expect(() => new StripePaymentGateway('', 'whsec_1')).toThrow(
      StripeNotConfiguredError,
    )
  })
})
