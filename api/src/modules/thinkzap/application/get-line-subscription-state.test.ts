import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { GetLineSubscriptionState } from './get-line-subscription-state'
import type {
  AplicationContext,
  GetAplicationContext,
  SubscriptionWithItems,
} from '@/modules/application/application/get-aplication-context'
import type { Plan } from '@/modules/application/domain/entities/plan'
import type { Subscription } from '@/modules/application/domain/entities/subscription'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'

const NOW = new Date('2026-08-03T12:00:00.000Z')

const plusDays = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000)

const PAID_PLAN: Plan = {
  id: '7',
  name: 'ThinkZap Pro',
  product: {
    id: '42',
    name: 'ThinkZap',
    billingModel: 'subscription',
    active: true,
  },
  amount: 4990,
  interval: 'monthly' as const,
  gatewayId: 'price_abc',
  provider: 'ZAPI',
  active: true,
}

/**
 * Plano de trial: grátis por construção, porque não tem price id no gateway. Sem
 * provider também — ele não precifica conector nenhum.
 */
const TRIAL_PLAN: Plan = {
  ...PAID_PLAN,
  id: '1',
  name: 'Teste',
  amount: 0,
  gatewayId: undefined,
  provider: undefined,
}

const aplication = {
  id: 'app-1',
  spaId: '512',
  customer: {
    id: 'domain-1',
    name: 'acme.bitrix24.com.br',
    memberId: 'member-1',
  },
  appCode: 'crmthink.thinkzap',
  title: 'ThinkZap — Acme',
  active: true,
  createdAt: NOW,
  updatedAt: NOW,
}

const subscriptionOf = (overrides: {
  id?: string
  status: Subscription['status']
  modality: Subscription['modality']
  plan?: Plan
  currentPeriodEnd?: Date
  gatewayId?: string
  items?: SubscriptionItem[]
}): SubscriptionWithItems => ({
  id: overrides.id ?? '21',
  name: 'Assinatura',
  plan: overrides.plan ?? PAID_PLAN,
  status: overrides.status,
  currentPeriodStart: plusDays(-10),
  currentPeriodEnd: overrides.currentPeriodEnd ?? plusDays(20),
  aplication,
  modality: overrides.modality,
  gatewayId: overrides.gatewayId,
  items: overrides.items ?? [],
})

/** Uma linha do conector pedido, para as contagens por plano. */
const lineOf = (
  id: string,
  provider: 'ZAPI' | 'HUBMESSAGE',
  status: 'active' | 'cancelled' = 'active',
): SubscriptionItem => ({
  id,
  name: 'Linha',
  subscription: '21',
  status,
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata:
    provider === 'ZAPI'
      ? { provider, zApiInstanceId: 'i', zApiInstanceToken: 't' }
      : { provider, hubmessageChannelId: 'c', wabaId: 'w' },
})

const makeUseCase = (subscriptions: SubscriptionWithItems[]) => {
  const execute = vi.fn(
    (): Promise<AplicationContext> =>
      Promise.resolve({
        customer: { ...aplication.customer, products: [] } as never,
        aplication,
        subscriptions,
      }),
  )

  return {
    useCase: new GetLineSubscriptionState({
      execute,
    } as unknown as GetAplicationContext),
    execute,
  }
}

const INPUT = { domainId: 'domain-1', appCode: 'crmthink.thinkzap' }

describe('GetLineSubscriptionState', () => {
  it('reporta ausência quando a instalação não tem assinatura', async () => {
    const { useCase } = makeUseCase([])

    await expect(useCase.execute(INPUT, NOW)).resolves.toEqual({
      status: 'none',
    })
  })

  /**
   * A metade de boleto do produto: assinatura criada à mão na SPA com status
   * ativo destrava a linha, e nenhuma chamada a gateway participa disso.
   */
  describe('modalidade manual', () => {
    it('ativa habilita a linha', async () => {
      const { useCase } = makeUseCase([
        subscriptionOf({ status: 'active', modality: 'manual' }),
      ])

      const state = await useCase.execute(INPUT, NOW)

      expect(state).toMatchObject({
        status: 'active',
        modality: 'manual',
        isTrial: false,
        entitlement: 'active',
      })
    })

    /**
     * `active` não depende da janela — ela só governa trial. Boleto vencido no
     * período mas ainda `active` continua habilitado, e quem muda o status é a
     * automação externa.
     */
    it('ativa com período no passado continua habilitada', async () => {
      const { useCase } = makeUseCase([
        subscriptionOf({
          status: 'active',
          modality: 'manual',
          currentPeriodEnd: plusDays(-30),
        }),
      ])

      expect((await useCase.execute(INPUT, NOW)).status).toBe('active')
      await expect(useCase.execute(INPUT, NOW)).resolves.toMatchObject({
        entitlement: 'active',
      })
    })

    it.each<[Subscription['status']]>([['past_due'], ['cancelled']])(
      'marcada %s bloqueia pelo mesmo caminho das demais',
      async status => {
        const { useCase } = makeUseCase([
          subscriptionOf({ status, modality: 'manual' }),
        ])

        await expect(useCase.execute(INPUT, NOW)).resolves.toMatchObject({
          status,
          entitlement: 'inactive',
        })
      },
    )

    /** Não existe portal do gateway para assinatura que não é dele. */
    it('não oferece portal de faturamento', async () => {
      const { useCase } = makeUseCase([
        subscriptionOf({ status: 'active', modality: 'manual' }),
      ])

      await expect(useCase.execute(INPUT, NOW)).resolves.toMatchObject({
        billingPortalAvailable: false,
      })
    })

    /** Já tem contrato: contratar de novo seria troca de plano, fora de escopo. */
    it('não oferece contratação enquanto está ativa', async () => {
      const { useCase } = makeUseCase([
        subscriptionOf({ status: 'active', modality: 'manual' }),
      ])

      await expect(useCase.execute(INPUT, NOW)).resolves.toMatchObject({
        canSubscribe: false,
      })
    })
  })

  describe('modalidade do gateway', () => {
    it('ativa oferece portal de faturamento', async () => {
      const { useCase } = makeUseCase([
        subscriptionOf({ status: 'active', modality: 'stripe' }),
      ])

      await expect(useCase.execute(INPUT, NOW)).resolves.toMatchObject({
        modality: 'stripe',
        billingPortalAvailable: true,
        canSubscribe: false,
      })
    })

    /** Assinatura encerrada não tem cartão a gerenciar. */
    it('cancelada não oferece portal, e volta a oferecer contratação', async () => {
      const { useCase } = makeUseCase([
        subscriptionOf({ status: 'cancelled', modality: 'stripe' }),
      ])

      await expect(useCase.execute(INPUT, NOW)).resolves.toMatchObject({
        billingPortalAvailable: false,
        canSubscribe: true,
      })
    })

    /** Inadimplência é transitória: o cartão continua sendo gerenciável. */
    it('past_due mantém o portal e bloqueia a linha', async () => {
      const { useCase } = makeUseCase([
        subscriptionOf({ status: 'past_due', modality: 'stripe' }),
      ])

      await expect(useCase.execute(INPUT, NOW)).resolves.toMatchObject({
        billingPortalAvailable: true,
        entitlement: 'inactive',
      })
    })
  })

  describe('trial', () => {
    it('em andamento reporta trial e oferece contratação', async () => {
      const { useCase } = makeUseCase([
        subscriptionOf({
          status: 'trialing',
          modality: 'manual',
          plan: TRIAL_PLAN,
        }),
      ])

      await expect(useCase.execute(INPUT, NOW)).resolves.toMatchObject({
        status: 'trialing',
        isTrial: true,
        entitlement: 'active',
        canSubscribe: true,
        billingPortalAvailable: false,
      })
    })

    it('vencido reporta trial expirado e oferece contratação', async () => {
      const { useCase } = makeUseCase([
        subscriptionOf({
          status: 'trialing',
          modality: 'manual',
          plan: TRIAL_PLAN,
          currentPeriodEnd: plusDays(-1),
        }),
      ])

      await expect(useCase.execute(INPUT, NOW)).resolves.toMatchObject({
        isTrial: true,
        entitlement: 'trial-expired',
        canSubscribe: true,
      })
    })

    /**
     * O estado normal depois de contratar: trial encerrado ao lado da paga ativa.
     * A vigente é a paga, e a de teste não influencia nada.
     */
    it('encerrado ao lado de paga ativa reporta a paga', async () => {
      const { useCase } = makeUseCase([
        subscriptionOf({
          id: '21',
          status: 'cancelled',
          modality: 'manual',
          plan: TRIAL_PLAN,
        }),
        subscriptionOf({ id: '22', status: 'active', modality: 'stripe' }),
      ])

      await expect(useCase.execute(INPUT, NOW)).resolves.toMatchObject({
        status: 'active',
        modality: 'stripe',
        isTrial: false,
        entitlement: 'active',
      })
    })
  })

  /**
   * Nem chave de API, nem segredo de webhook, nem o id da assinatura no gateway.
   * A tela não precisa do id para abrir o portal — a rota resolve no servidor — e
   * o que não é enviado não vaza.
   */
  it('não devolve nenhuma credencial do gateway', async () => {
    const { useCase } = makeUseCase([
      subscriptionOf({ status: 'active', modality: 'stripe' }),
    ])

    const serialized = JSON.stringify(await useCase.execute(INPUT, NOW))

    expect(serialized).not.toContain('gatewayId')
    expect(serialized).not.toContain('sub_')
    expect(serialized).not.toContain('sk_')
    expect(serialized).not.toContain('whsec_')
  })

  /**
   * A instalação pode ser cobrada por mais de um plano na mesma assinatura do
   * gateway. Reportar um deles faria a tela mostrar menos do que o cliente paga.
   */
  describe('composição do contrato', () => {
    const OFFICIAL_PLAN: Plan = {
      ...PAID_PLAN,
      id: '8',
      name: 'Pro Oficial',
      amount: 9990,
      provider: 'HUBMESSAGE',
    }

    it('reporta um item por plano, com o número de linhas de cada um', async () => {
      const { useCase } = makeUseCase([
        subscriptionOf({
          id: '99',
          status: 'active',
          modality: 'stripe',
          gatewayId: 'sub_1',
          items: [lineOf('1', 'ZAPI'), lineOf('2', 'ZAPI')],
        }),
        subscriptionOf({
          id: '100',
          status: 'active',
          modality: 'stripe',
          gatewayId: 'sub_1',
          plan: OFFICIAL_PLAN,
          items: [lineOf('3', 'HUBMESSAGE')],
        }),
      ])

      const state = await useCase.execute(INPUT, NOW)

      expect(state).toMatchObject({
        status: 'active',
        modality: 'stripe',
        plans: [
          { id: '7', lineCount: 2, provider: 'ZAPI' },
          { id: '8', lineCount: 1, provider: 'HUBMESSAGE' },
        ],
      })
    })

    /** Contrato de outro id no gateway não entra: são contratos diferentes. */
    it('não soma assinatura de outro id de gateway', async () => {
      const { useCase } = makeUseCase([
        subscriptionOf({
          id: '99',
          status: 'active',
          modality: 'stripe',
          gatewayId: 'sub_1',
          items: [lineOf('1', 'ZAPI')],
        }),
        subscriptionOf({
          id: '50',
          status: 'cancelled',
          modality: 'stripe',
          gatewayId: 'sub_0',
          plan: OFFICIAL_PLAN,
          items: [lineOf('9', 'HUBMESSAGE')],
        }),
      ])

      const state = await useCase.execute(INPUT, NOW)

      expect(
        (state as { plans: Array<{ id: string }> }).plans.map(p => p.id),
      ).toEqual(['7'])
    })

    it('linha cancelada não conta na cobrança', async () => {
      const { useCase } = makeUseCase([
        subscriptionOf({
          status: 'active',
          modality: 'stripe',
          gatewayId: 'sub_1',
          items: [lineOf('1', 'ZAPI'), lineOf('2', 'ZAPI', 'cancelled')],
        }),
      ])

      expect(await useCase.execute(INPUT, NOW)).toMatchObject({
        plans: [{ id: '7', lineCount: 1 }],
      })
    })
  })

  /**
   * `canCreateLine` vem do servidor porque a regra é a mesma que a rota usa para
   * recusar. Duplicada na tela, as duas divergiriam — e o cliente veria um botão que
   * responde `409`.
   */
  describe('canCreateLine', () => {
    it('é verdadeiro num contrato pago com linha', async () => {
      const { useCase } = makeUseCase([
        subscriptionOf({
          status: 'active',
          modality: 'stripe',
          gatewayId: 'sub_1',
          items: [lineOf('1', 'ZAPI')],
        }),
      ])

      expect(await useCase.execute(INPUT, NOW)).toMatchObject({
        canCreateLine: true,
      })
    })

    /** A primeira linha nasce pelo trial, não por esta superfície. */
    it('é falso sem nenhuma linha', async () => {
      const { useCase } = makeUseCase([
        subscriptionOf({ status: 'active', modality: 'stripe', items: [] }),
      ])

      expect(await useCase.execute(INPUT, NOW)).toMatchObject({
        canCreateLine: false,
      })
    })

    /** Boleto é mantido por automação fora do produto. */
    it('é falso na modalidade manual paga', async () => {
      const { useCase } = makeUseCase([
        subscriptionOf({
          status: 'active',
          modality: 'manual',
          items: [lineOf('1', 'ZAPI')],
        }),
      ])

      expect(await useCase.execute(INPUT, NOW)).toMatchObject({
        canCreateLine: false,
      })
    })

    /**
     * O trial lê `manual` porque nasce sem o campo. Quem está testando pode contratar
     * a segunda linha — e a do teste entra na assinatura no mesmo ato.
     */
    it('é verdadeiro no trial, apesar de ele ler manual', async () => {
      const { useCase } = makeUseCase([
        subscriptionOf({
          status: 'trialing',
          modality: 'manual',
          plan: TRIAL_PLAN,
          items: [lineOf('1', 'ZAPI')],
        }),
      ])

      expect(await useCase.execute(INPUT, NOW)).toMatchObject({
        canCreateLine: true,
      })
    })
  })
})

/**
 * A leitura de estado é o caminho que a tela chama a cada abertura. Um import de
 * cliente de gateway aqui colocaria a latência e o rate limit de um terceiro na
 * frente da tela, e uma indisponibilidade deles esconderia o contrato de todo
 * mundo — inclusive de quem paga por boleto e não tem nada a ver com o gateway.
 */
describe('get-line-subscription-state (estrutura)', () => {
  const source = readFileSync(
    join(__dirname, 'get-line-subscription-state.ts'),
    'utf8',
  )

  it('não importa cliente de gateway de pagamento', () => {
    expect(source).not.toMatch(/from 'stripe'|require\('stripe'\)/)
  })
})
