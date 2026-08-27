import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  composeContractBilling,
  composeContractByPlan,
  countActiveLinesByProvider,
  isTrialSubscription,
  resolveCurrentContract,
  resolveCurrentSubscription,
  resolvePlanForProvider,
  type ContractPlanLines,
} from './line-subscription'
import type { Subscription } from '@/modules/application/domain/entities/subscription'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const NOW = new Date('2026-08-03T12:00:00.000Z')
const plusDays = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000)

/**
 * `gatewayId: null` é "plano de trial". Sentinela explícita em vez de
 * `undefined`, porque `undefined` num argumento posicional dispara o default e o
 * teste passaria a afirmar o contrário do que diz.
 */
const sub = (
  id: string,
  status: Subscription['status'],
  currentPeriodEnd = plusDays(10),
  gatewayId: string | null = 'price_abc',
) =>
  ({
    id,
    status,
    currentPeriodEnd,
    plan: { gatewayId: gatewayId ?? undefined },
  }) as unknown as Subscription

describe('resolveCurrentSubscription', () => {
  it('devolve null sem assinatura', () => {
    expect(resolveCurrentSubscription([])).toBeNull()
  })

  /**
   * Do estado mais vivo para o mais morto: uma paga inadimplente é mais
   * relevante para a tela que um trial encerrado.
   */
  it('prefere ativa a qualquer outra', () => {
    const chosen = resolveCurrentSubscription([
      sub('1', 'cancelled'),
      sub('2', 'trialing'),
      sub('3', 'active'),
      sub('4', 'past_due'),
    ])

    expect(chosen?.id).toBe('3')
  })

  it('prefere past_due a trial e a cancelada', () => {
    expect(
      resolveCurrentSubscription([
        sub('1', 'cancelled'),
        sub('2', 'trialing'),
        sub('3', 'past_due'),
      ])?.id,
    ).toBe('3')
  })

  /** O estado normal depois de contratar: trial encerrado + paga ativa. */
  it('escolhe a paga quando o trial ficou cancelado', () => {
    expect(
      resolveCurrentSubscription([
        sub('trial', 'cancelled', plusDays(-1), null),
        sub('paga', 'active'),
      ])?.id,
    ).toBe('paga')
  })

  /**
   * Sem o desempate, a resposta dependeria da ordem em que o CRM devolveu os
   * itens — ordem de criação, que não significa nada aqui.
   */
  it('desempata pelo fim de período mais recente', () => {
    expect(
      resolveCurrentSubscription([
        sub('antiga', 'cancelled', plusDays(-60)),
        sub('recente', 'cancelled', plusDays(-1)),
      ])?.id,
    ).toBe('recente')
  })

  it('não muta a lista recebida', () => {
    const list = [sub('1', 'cancelled'), sub('2', 'active')]

    resolveCurrentSubscription(list)

    expect(list.map(s => s.id)).toEqual(['1', '2'])
  })
})

describe('isTrialSubscription', () => {
  /**
   * Derivado do plano, não do status: um trial encerrado fica `cancelled`,
   * indistinguível de uma paga cancelada pelo status.
   */
  it('é trial quando o plano não tem id no gateway', () => {
    expect(isTrialSubscription(sub('1', 'cancelled', plusDays(-1), null))).toBe(
      true,
    )
  })

  it('não é trial quando o plano tem price id', () => {
    expect(isTrialSubscription(sub('1', 'trialing'))).toBe(false)
  })
})

const item = (
  provider: 'ZAPI' | 'HUBMESSAGE' | 'NONE',
  status: 'active' | 'cancelled' = 'active',
) =>
  ({
    status,
    metadata:
      provider === 'ZAPI'
        ? { provider, zApiInstanceId: 'i', zApiInstanceToken: 't' }
        : provider === 'HUBMESSAGE'
          ? { provider, hubmessageChannelId: 'c', wabaId: 'w' }
          : { provider },
  }) as unknown as SubscriptionItem

describe('resolveCurrentContract', () => {
  const contractSub = (
    id: string,
    status: Subscription['status'],
    gatewayId: string | undefined,
    planId = 'p1',
  ) =>
    ({
      id,
      status,
      currentPeriodEnd: plusDays(10),
      gatewayId,
      plan: { id: planId, gatewayId: 'price_abc' },
      items: [],
    }) as unknown as Subscription & { items: SubscriptionItem[] }

  it('devolve lista vazia sem assinatura', () => {
    expect(resolveCurrentContract([])).toEqual([])
  })

  /** Sem id no gateway não há o que agrupar: o trial é contrato de uma só. */
  it('trial é contrato de uma assinatura', () => {
    const trial = contractSub('t', 'trialing', undefined)

    expect(resolveCurrentContract([trial]).map(s => s.id)).toEqual(['t'])
  })

  it('agrupa as irmãs que compartilham o id do gateway, vigente primeiro', () => {
    const contract = resolveCurrentContract([
      contractSub('b', 'active', 'sub_1', 'p2'),
      contractSub('a', 'active', 'sub_1', 'p1'),
    ])

    expect(contract).toHaveLength(2)
    expect(contract[0]?.status).toBe('active')
  })

  /**
   * Contrato antigo não entra no vigente: agrupar por "tem gatewayId" juntaria a
   * assinatura cancelada de um contrato anterior com a paga de agora.
   */
  it('não agrupa assinatura de outro id de gateway', () => {
    const contract = resolveCurrentContract([
      contractSub('velha', 'cancelled', 'sub_0'),
      contractSub('nova', 'active', 'sub_1'),
    ])

    expect(contract.map(s => s.id)).toEqual(['nova'])
  })

  it('não agrupa dois trials pela ausência de id', () => {
    const contract = resolveCurrentContract([
      contractSub('t1', 'trialing', undefined),
      contractSub('t2', 'trialing', undefined),
    ])

    expect(contract).toHaveLength(1)
  })
})

describe('composeContractByPlan', () => {
  const withItems = (
    planId: string,
    items: SubscriptionItem[],
  ): Subscription & { items: SubscriptionItem[] } =>
    ({
      id: `s-${planId}`,
      plan: { id: planId, amount: 4990 },
      items,
    }) as unknown as Subscription & { items: SubscriptionItem[] }

  it('conta as linhas ativas de cada plano', () => {
    const composition = composeContractByPlan([
      withItems('p1', [item('ZAPI'), item('ZAPI')]),
      withItems('p2', [item('HUBMESSAGE')]),
    ])

    expect(composition.map(entry => [entry.plan.id, entry.lineCount])).toEqual([
      ['p1', 2],
      ['p2', 1],
    ])
  })

  /** Linha cancelada não é serviço prestado, então não entra na contagem cobrada. */
  it('ignora linha cancelada na contagem', () => {
    const composition = composeContractByPlan([
      withItems('p1', [item('ZAPI'), item('ZAPI', 'cancelled')]),
    ])

    expect(composition[0]?.lineCount).toBe(1)
  })
})

describe('countActiveLinesByProvider', () => {
  it('devolve mapa vazio sem linha', () => {
    expect(countActiveLinesByProvider([{ items: [] }]).size).toBe(0)
  })

  /** Item de cobrança sem conector não é linha. */
  it('ignora item sem conector', () => {
    expect(countActiveLinesByProvider([{ items: [item('NONE')] }]).size).toBe(0)
  })

  it('conta por conector, somando todas as assinaturas', () => {
    const counts = countActiveLinesByProvider([
      { items: [item('ZAPI'), item('ZAPI')] },
      { items: [item('HUBMESSAGE')] },
    ])

    expect(counts.get('ZAPI')).toBe(2)
    expect(counts.get('HUBMESSAGE')).toBe(1)
  })

  it('ignora linha cancelada', () => {
    const counts = countActiveLinesByProvider([
      { items: [item('ZAPI'), item('ZAPI', 'cancelled')] },
    ])

    expect(counts.get('ZAPI')).toBe(1)
  })

  /**
   * Providers misturados deixaram de ser estado especial: cada um tem a contagem
   * dele, e cada contagem vira o `quantity` do `line_item` do plano dele.
   */
  it('não trata providers misturados como estado especial', () => {
    const counts = countActiveLinesByProvider([
      { items: [item('ZAPI'), item('HUBMESSAGE')] },
    ])

    expect([...counts.entries()].sort()).toEqual([
      ['HUBMESSAGE', 1],
      ['ZAPI', 1],
    ])
  })
})

describe('resolvePlanForProvider', () => {
  const plan = (id: string, provider?: 'ZAPI' | 'HUBMESSAGE') => ({
    id,
    provider,
  })

  it('resolve quando há um plano do conector', () => {
    const result = resolvePlanForProvider(
      [plan('1', 'ZAPI'), plan('2', 'HUBMESSAGE')],
      'ZAPI',
    )

    expect(result).toEqual({ kind: 'resolved', plan: plan('1', 'ZAPI') })
  })

  /** Configuração faltando na SPA de planos, nomeada como tal. */
  it('devolve missing quando o conector não tem plano', () => {
    expect(resolvePlanForProvider([plan('1', 'ZAPI')], 'HUBMESSAGE')).toEqual({
      kind: 'missing',
      provider: 'HUBMESSAGE',
    })
  })

  /**
   * Dois planos do mesmo conector: escolher cobraria o preço de um pelo uso do
   * outro, em silêncio. O estado é nomeado e os candidatos vão no erro.
   */
  it('devolve ambiguous com dois planos do mesmo conector', () => {
    expect(
      resolvePlanForProvider([plan('1', 'ZAPI'), plan('2', 'ZAPI')], 'ZAPI'),
    ).toEqual({ kind: 'ambiguous', provider: 'ZAPI', planIds: ['1', '2'] })
  })

  it('ignora plano sem provider declarado', () => {
    expect(resolvePlanForProvider([plan('1')], 'ZAPI')).toEqual({
      kind: 'missing',
      provider: 'ZAPI',
    })
  })
})

/**
 * Mesma postura de `connector-trial`: decisão pura, sobre dado que o chamador já
 * tem. Um import de infra aqui arrastaria Prisma, Redis ou cliente de gateway
 * para dentro de uma escolha que é ordenação de lista.
 */
describe('line-subscription (estrutura)', () => {
  const source = readFileSync(join(__dirname, 'line-subscription.ts'), 'utf8')
  const imports = source.match(/^import .*$/gm) ?? []

  it('só tem imports de tipo', () => {
    expect(imports.length).toBeGreaterThan(0)
    for (const line of imports) {
      expect(line).toMatch(/^import type /)
    }
  })

  it('não menciona gateway de pagamento', () => {
    expect(source).not.toMatch(/stripe/i)
  })
})

describe('composeContractBilling', () => {
  const entry = (planId: string, gatewayId: string | null, lineCount: number) =>
    ({
      subscription: { id: `s-${planId}` },
      plan: { id: planId, gatewayId: gatewayId ?? undefined },
      lineCount,
    }) as unknown as ContractPlanLines

  it('paridade: tudo cobrado, nada bonificado', () => {
    const [plan] = composeContractBilling(
      [entry('p1', 'price_web', 2)],
      [{ priceId: 'price_web', quantity: 2 }],
    )

    expect(plan).toMatchObject({
      billedCount: 2,
      compedCount: 0,
      overBilled: false,
    })
  })

  /** O caso que motivou a change: a instalação usa mais do que a fatura cobra. */
  it('cortesia: o excedente vira bonificado', () => {
    const [plan] = composeContractBilling(
      [entry('p1', 'price_web', 3)],
      [{ priceId: 'price_web', quantity: 2 }],
    )

    expect(plan).toMatchObject({
      billedCount: 2,
      compedCount: 1,
      overBilled: false,
    })
  })

  it('plano sem item no gateway é inteiramente bonificado', () => {
    const [plan] = composeContractBilling(
      [entry('p1', 'price_business', 2)],
      [{ priceId: 'price_web', quantity: 2 }],
    )

    expect(plan).toMatchObject({ billedCount: 0, compedCount: 2 })
  })

  it('plano de trial, sem price id, não casa com item nenhum', () => {
    const [plan] = composeContractBilling(
      [entry('trial', null, 1)],
      [{ priceId: 'price_web', quantity: 1 }],
    )

    expect(plan).toMatchObject({ billedCount: 0, compedCount: 1 })
  })

  /**
   * Gateway cobrando mais do que a SPA tem é divergência, não cortesia negativa.
   * A contagem cobrada segue a do gateway, porque é ela que está na fatura.
   */
  it('excedente negativo não vira bonificado negativo', () => {
    const [plan] = composeContractBilling(
      [entry('p1', 'price_web', 1)],
      [{ priceId: 'price_web', quantity: 2 }],
    )

    expect(plan).toMatchObject({
      billedCount: 2,
      compedCount: 0,
      overBilled: true,
    })
  })

  it('casa cada plano pelo price id, não pela ordem', () => {
    const billing = composeContractBilling(
      [entry('p1', 'price_web', 2), entry('p2', 'price_business', 1)],
      [
        { priceId: 'price_business', quantity: 1 },
        { priceId: 'price_web', quantity: 2 },
      ],
    )

    expect(billing.map(plan => [plan.plan.id, plan.billedCount])).toEqual([
      ['p1', 2],
      ['p2', 1],
    ])
  })

  it('sem itens do gateway, tudo é bonificado', () => {
    const billing = composeContractBilling(
      [entry('p1', 'price_web', 2), entry('p2', 'price_business', 1)],
      [],
    )

    expect(billing.map(plan => plan.compedCount)).toEqual([2, 1])
  })

  /**
   * Dois `line_items` no mesmo price é estado que o gateway admite. Somar é a
   * leitura certa: são as duas partes da mesma cobrança daquele preço.
   */
  it('soma itens repetidos do mesmo price', () => {
    const [plan] = composeContractBilling(
      [entry('p1', 'price_web', 3)],
      [
        { priceId: 'price_web', quantity: 1 },
        { priceId: 'price_web', quantity: 2 },
      ],
    )

    expect(plan).toMatchObject({ billedCount: 3, compedCount: 0 })
  })
})
