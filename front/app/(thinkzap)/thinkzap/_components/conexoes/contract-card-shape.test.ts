import { describe, expect, it } from 'vitest'
import { hasCompedLines, resolveContractCardShape } from './contract-card-shape'
import type {
  ContractPlan,
  SubscriptionState,
} from '@/app/hooks/use-line-subscription'

const plan = (overrides: Partial<ContractPlan> = {}): ContractPlan => ({
  id: '7',
  name: 'ThinkZap Pro',
  amount: 4990,
  chargedAmount: 4990,
  interval: 'monthly',
  provider: 'ZAPI',
  lineCount: 1,
  billedCount: 1,
  compedCount: 0,
  ...overrides,
})

const state = (
  overrides: Partial<SubscriptionState> = {},
): SubscriptionState => ({
  status: 'active',
  modality: 'stripe',
  isTrial: false,
  currentPeriodStart: '2026-08-01T00:00:00.000Z',
  currentPeriodEnd: '2026-09-01T00:00:00.000Z',
  plans: [plan()],
  contractTotal: 4990,
  entitlement: 'active',
  billingPortalAvailable: true,
  canSubscribe: false,
  canCreateLine: true,
  ...overrides,
})

describe('resolveContractCardShape', () => {
  it('sem assinatura, o card não aparece', () => {
    expect(resolveContractCardShape({ status: 'none' })).toMatchObject({
      kind: 'ausente',
    })
  })

  /** Quem fala do teste é o TrialCard. */
  it('só trial, o card não aparece', () => {
    expect(resolveContractCardShape(state({ isTrial: true }))).toMatchObject({
      kind: 'ausente',
    })
  })

  it('stripe com composição mostra a forma completa', () => {
    const shape = resolveContractCardShape(state())

    expect(shape.kind).toBe('completa')
  })

  it('boleto cai na forma reduzida', () => {
    expect(
      resolveContractCardShape(state({ modality: 'manual' })),
    ).toMatchObject({
      kind: 'reduzida',
    })
  })

  /**
   * Api antigo mandava composição para boleto também. A modalidade é a segunda
   * guarda justamente para essa combinação não escapar pela forma completa.
   */
  it('boleto com composição continua reduzido', () => {
    expect(
      resolveContractCardShape(state({ modality: 'manual', plans: [plan()] })),
    ).toMatchObject({ kind: 'reduzida' })
  })

  /** Gateway fora do ar: o servidor omite a composição. */
  it('stripe sem composição cai na forma reduzida', () => {
    expect(resolveContractCardShape(state({ plans: undefined }))).toMatchObject(
      {
        kind: 'reduzida',
      },
    )
  })

  it('composição vazia cai na forma reduzida', () => {
    expect(resolveContractCardShape(state({ plans: [] }))).toMatchObject({
      kind: 'reduzida',
    })
  })

  it('contrato cancelado ainda mostra a composição', () => {
    expect(resolveContractCardShape(state({ status: 'cancelled' })).kind).toBe(
      'completa',
    )
  })
})

describe('hasCompedLines', () => {
  it('falso quando nenhum plano tem bonificada', () => {
    expect(hasCompedLines([plan(), plan({ id: '8' })])).toBe(false)
  })

  it('verdadeiro quando algum plano tem bonificada', () => {
    expect(hasCompedLines([plan(), plan({ id: '8', compedCount: 2 })])).toBe(
      true,
    )
  })

  /** Api antigo não manda o campo: ausência não é bonificação. */
  it('campo ausente não conta como bonificada', () => {
    expect(hasCompedLines([plan({ compedCount: undefined })])).toBe(false)
  })
})
