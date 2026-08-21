import { describe, expect, it, vi } from 'vitest'

import { Plan, PlanProvider } from '@/modules/application/domain/entities/plan'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import {
  PlanForProviderAmbiguousError,
  PlanForProviderMissingError,
  buildContractLineItems,
} from './build-contract-line-items'

vi.mock('@/config/env', () => ({
  env: {
    payments: {
      spa: { planEntityType: 1138 },
      stripe: { environment: 'homolog' },
    },
  },
}))

const planWith = (overrides: Partial<Plan> & { id: string }): Plan => ({
  name: `Plano ${overrides.id}`,
  product: {
    id: '42',
    name: 'ThinkZap',
    billingModel: 'subscription',
    active: true,
  },
  amount: 4990,
  interval: 'monthly',
  active: true,
  ...overrides,
})

const lineOf = (provider: PlanProvider): SubscriptionItem =>
  ({
    status: 'active',
    metadata: { provider },
  }) as unknown as SubscriptionItem

const contractWith = (...providers: PlanProvider[]) => [
  { items: providers.map(lineOf) },
]

describe('buildContractLineItems', () => {
  it('emite um line_item por plano, com a contagem de linhas de cada conector', () => {
    const zapi = planWith({
      id: '5',
      provider: 'ZAPI',
      gatewayId: 'price_web',
    })
    const hub = planWith({
      id: '6',
      provider: 'HUBMESSAGE',
      gatewayId: 'price_biz',
    })

    const { lineItems } = buildContractLineItems({
      contract: contractWith('ZAPI', 'ZAPI', 'HUBMESSAGE'),
      offerablePlans: [zapi, hub],
    })

    expect(lineItems).toEqual([
      { priceId: 'price_web', quantity: 2 },
      { priceId: 'price_biz', quantity: 1 },
    ])
  })

  /**
   * As duas causas de "conector sem plano" têm correções diferentes: uma é item a
   * cadastrar na SPA, a outra é campo a preencher num item que já existe. Reportar as
   * duas igual manda quem lê procurar no lugar errado.
   */
  describe('recusa por conector sem plano', () => {
    it('quando nenhum item de plano declara o conector, manda cadastrar', () => {
      let thrown: PlanForProviderMissingError | undefined

      try {
        buildContractLineItems({
          contract: contractWith('HUBMESSAGE'),
          offerablePlans: [],
          plansForDiagnosis: [
            planWith({ id: '5', provider: 'ZAPI', gatewayId: 'price_web' }),
          ],
        })
      } catch (error) {
        thrown = error as PlanForProviderMissingError
      }

      expect(thrown).toBeInstanceOf(PlanForProviderMissingError)
      expect(thrown?.gap.kind).toBe('no-plan')
      expect(thrown?.message).toContain('HUBMESSAGE')
    })

    it('quando o plano existe sem price id no ambiente, nomeia campo e ambiente', () => {
      let thrown: PlanForProviderMissingError | undefined

      try {
        buildContractLineItems({
          contract: contractWith('HUBMESSAGE'),
          // Filtrado por `isOfferable`: sem price id, o plano não chega aqui.
          offerablePlans: [],
          plansForDiagnosis: [
            planWith({ id: '6', provider: 'HUBMESSAGE', gatewayId: undefined }),
          ],
        })
      } catch (error) {
        thrown = error as PlanForProviderMissingError
      }

      expect(thrown).toBeInstanceOf(PlanForProviderMissingError)
      expect(thrown?.gap).toEqual({
        kind: 'no-price-id',
        field: 'ufCrm89GatewayIdHomolog',
        environment: 'homolog',
        planIds: ['6'],
      })
      expect(thrown?.message).toContain('ufCrm89GatewayIdHomolog')
      expect(thrown?.message).toContain('homolog')
    })

    /**
     * Sem catálogo de diagnóstico a mensagem é a que já existia: chamador que não
     * passa a lista não fica pior do que estava.
     */
    it('sem catálogo de diagnóstico assume conector sem plano', () => {
      expect(() =>
        buildContractLineItems({
          contract: contractWith('ZAPI'),
          offerablePlans: [],
        }),
      ).toThrow(PlanForProviderMissingError)
    })
  })

  /**
   * O catálogo de diagnóstico não participa da resolução: se participasse, um plano
   * sem price id disputaria com o ofertável e viraria `ambiguous`, recusando uma
   * contratação que hoje funciona.
   */
  it('plano sem price id no diagnóstico não torna o conector ambíguo', () => {
    const ofertavel = planWith({
      id: '5',
      provider: 'ZAPI',
      gatewayId: 'price_web',
    })

    const { lineItems } = buildContractLineItems({
      contract: contractWith('ZAPI'),
      offerablePlans: [ofertavel],
      plansForDiagnosis: [
        ofertavel,
        planWith({ id: '9', provider: 'ZAPI', gatewayId: undefined }),
      ],
    })

    expect(lineItems).toEqual([{ priceId: 'price_web', quantity: 1 }])
  })

  it('dois planos ofertáveis para o mesmo conector continuam recusa por ambiguidade', () => {
    expect(() =>
      buildContractLineItems({
        contract: contractWith('ZAPI'),
        offerablePlans: [
          planWith({ id: '5', provider: 'ZAPI', gatewayId: 'price_a' }),
          planWith({ id: '9', provider: 'ZAPI', gatewayId: 'price_b' }),
        ],
      }),
    ).toThrow(PlanForProviderAmbiguousError)
  })
})
