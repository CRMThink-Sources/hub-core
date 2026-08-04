import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isTrialSubscription,
  resolveCurrentSubscription,
  resolveLineProvider,
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

describe('resolveLineProvider', () => {
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

  it('resolve NONE sem assinatura', () => {
    expect(resolveLineProvider([])).toBe('NONE')
  })

  it('resolve NONE quando não há linha', () => {
    expect(resolveLineProvider([{ items: [] }])).toBe('NONE')
  })

  /** Item de cobrança sem conector não consome nada. */
  it('resolve NONE quando a linha não tem conector', () => {
    expect(resolveLineProvider([{ items: [item('NONE')] }])).toBe('NONE')
  })

  it.each([['ZAPI'], ['HUBMESSAGE']] as const)('resolve %s', provider => {
    expect(resolveLineProvider([{ items: [item(provider)] }])).toBe(provider)
  })

  /** Linha cancelada não consome conector, então não restringe o plano. */
  it('ignora linha cancelada', () => {
    expect(
      resolveLineProvider([
        { items: [item('HUBMESSAGE', 'cancelled'), item('ZAPI')] },
      ]),
    ).toBe('ZAPI')
  })

  it('resolve o provider olhando todas as assinaturas', () => {
    expect(
      resolveLineProvider([{ items: [] }, { items: [item('HUBMESSAGE')] }]),
    ).toBe('HUBMESSAGE')
  })

  it('não confunde duas linhas do mesmo provider com mistura', () => {
    expect(resolveLineProvider([{ items: [item('ZAPI'), item('ZAPI')] }])).toBe(
      'ZAPI',
    )
  })

  /**
   * Providers diferentes na mesma instalação: nomeado, não escolhido. Uma assinatura
   * carrega um plano só, e `quantity` multiplica um preço só — escolher um dos dois
   * cobraria o preço de um provider pelo uso de dois.
   */
  it('resolve MIXED com providers diferentes', () => {
    expect(
      resolveLineProvider([{ items: [item('ZAPI'), item('HUBMESSAGE')] }]),
    ).toBe('MIXED')
  })

  it('resolve MIXED com os providers em assinaturas diferentes', () => {
    expect(
      resolveLineProvider([
        { items: [item('ZAPI')] },
        { items: [item('HUBMESSAGE')] },
      ]),
    ).toBe('MIXED')
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
