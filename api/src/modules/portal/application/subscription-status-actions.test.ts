import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import {
  ActivateSubscription,
  DeactivateSubscription,
  SubscriptionStatusActionDeps,
} from './subscription-status-actions'
import { SubscriptionNotFoundError } from '@/modules/application/domain/errors/subscription-not-found.error'
import {
  PortalAppNotFoundError,
  ProviderEffectsDisabledError,
} from '../domain/errors/portal-domain.errors'
import {
  SubscriptionActionRefusedError,
  SubscriptionNotInAppError,
  SubscriptionPeriodEndError,
} from '../domain/errors/subscription-action.errors'

const NOW = new Date('2026-10-28T15:00:00.000Z')

const subscription = (overrides: Record<string, unknown> = {}) => ({
  id: 'sub-1',
  status: 'cancelled',
  modality: 'manual',
  currentPeriodEnd: new Date('2026-11-17T23:59:59.999Z'),
  aplication: { spaId: '1060-1' },
  ...overrides,
})

const makeDeps = (
  options: {
    sub?: ReturnType<typeof subscription>
    appSpaId?: string | null
    app?: null
    providerEffectsEnabled?: boolean
  } = {},
) => {
  const sub = options.sub ?? subscription()
  const getSubscription = vi.fn().mockResolvedValue(sub)
  const updateSubscription = vi
    .fn()
    .mockImplementation((_id: string, patch: Record<string, unknown>) =>
      Promise.resolve({ ...sub, ...patch }),
    )
  const deps: SubscriptionStatusActionDeps = {
    apps: {
      findById: vi
        .fn()
        .mockResolvedValue(
          options.app === null
            ? null
            : { id: 'app-1', spaId: options.appSpaId ?? '1060-1' },
        ),
    },
    subscriptions: { getSubscription, updateSubscription } as never,
    providerEffectsEnabled: options.providerEffectsEnabled ?? true,
    now: () => NOW,
  }
  return { deps, getSubscription, updateSubscription }
}

const INPUT = { appId: 'app-1', subscriptionId: 'sub-1' }

describe('ActivateSubscription', () => {
  it('grava Ativo e limpa o Vencido em, mantendo o período vigente', async () => {
    const { deps, updateSubscription } = makeDeps()

    const result = await new ActivateSubscription(deps).execute(INPUT)

    expect(updateSubscription).toHaveBeenCalledWith('sub-1', {
      status: 'active',
      pastDueAt: null,
    })
    expect(result.status).toBe('active')
  })

  it('grava o novo fim de período no fim do dia UTC', async () => {
    const { deps, updateSubscription } = makeDeps()

    await new ActivateSubscription(deps).execute({
      ...INPUT,
      currentPeriodEnd: '2026-12-01',
    })

    expect(updateSubscription).toHaveBeenCalledWith('sub-1', {
      status: 'active',
      pastDueAt: null,
      currentPeriodEnd: new Date('2026-12-01T23:59:59.999Z'),
    })
  })

  it('período encerrado sem novo fim: period-end-required, nada gravado', async () => {
    const { deps, updateSubscription } = makeDeps({
      sub: subscription({
        status: 'past_due',
        currentPeriodEnd: new Date('2026-10-27T23:59:59.999Z'),
      }),
    })

    await expect(
      new ActivateSubscription(deps).execute(INPUT),
    ).rejects.toMatchObject(
      new SubscriptionPeriodEndError('period-end-required'),
    )
    expect(updateSubscription).not.toHaveBeenCalled()
  })

  it.each(['2026-10-28', '2026-10-01', '01/12/2026', '2026-13-40'])(
    'novo fim %s inválido (não posterior a hoje ou mal formado)',
    async currentPeriodEnd => {
      const { deps, updateSubscription } = makeDeps()

      await expect(
        new ActivateSubscription(deps).execute({ ...INPUT, currentPeriodEnd }),
      ).rejects.toBeInstanceOf(SubscriptionPeriodEndError)
      expect(updateSubscription).not.toHaveBeenCalled()
    },
  )

  it('já ativa: already-active, nada gravado', async () => {
    const { deps, updateSubscription } = makeDeps({
      sub: subscription({ status: 'active' }),
    })

    await expect(
      new ActivateSubscription(deps).execute(INPUT),
    ).rejects.toMatchObject({ reason: 'already-active' })
    expect(updateSubscription).not.toHaveBeenCalled()
  })

  it('Stripe: gateway-managed, nada gravado', async () => {
    const { deps, updateSubscription } = makeDeps({
      sub: subscription({ modality: 'stripe' }),
    })

    await expect(
      new ActivateSubscription(deps).execute(INPUT),
    ).rejects.toMatchObject({ reason: 'gateway-managed' })
    expect(updateSubscription).not.toHaveBeenCalled()
  })

  it('assinatura de outra instalação: SubscriptionNotInAppError', async () => {
    const { deps } = makeDeps({ appSpaId: '1060-9' })

    await expect(
      new ActivateSubscription(deps).execute(INPUT),
    ).rejects.toBeInstanceOf(SubscriptionNotInAppError)
  })

  it('instalação sem espelho: SubscriptionNotInAppError sem ler a SPA', async () => {
    const { deps, getSubscription } = makeDeps({ appSpaId: null })
    ;(deps.apps.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'app-1',
      spaId: null,
    })

    await expect(
      new ActivateSubscription(deps).execute(INPUT),
    ).rejects.toBeInstanceOf(SubscriptionNotInAppError)
    expect(getSubscription).not.toHaveBeenCalled()
  })

  it('assinatura inexistente na SPA: SubscriptionNotInAppError', async () => {
    const { deps, getSubscription } = makeDeps()
    getSubscription.mockRejectedValue(new SubscriptionNotFoundError('sub-1'))

    await expect(
      new ActivateSubscription(deps).execute(INPUT),
    ).rejects.toBeInstanceOf(SubscriptionNotInAppError)
  })

  it('instalação inexistente: PortalAppNotFoundError', async () => {
    const { deps } = makeDeps({ app: null })

    await expect(
      new ActivateSubscription(deps).execute(INPUT),
    ).rejects.toBeInstanceOf(PortalAppNotFoundError)
  })

  it('efeitos de provider desligados: recusa antes de ler qualquer coisa', async () => {
    const { deps, getSubscription } = makeDeps({
      providerEffectsEnabled: false,
    })

    await expect(
      new ActivateSubscription(deps).execute(INPUT),
    ).rejects.toBeInstanceOf(ProviderEffectsDisabledError)
    expect(getSubscription).not.toHaveBeenCalled()
  })
})

describe('DeactivateSubscription', () => {
  it('grava Cancelado com a data de cancelamento de hoje', async () => {
    const { deps, updateSubscription } = makeDeps({
      sub: subscription({ status: 'active' }),
    })

    const result = await new DeactivateSubscription(deps).execute(INPUT)

    expect(updateSubscription).toHaveBeenCalledWith('sub-1', {
      status: 'cancelled',
      canceledAt: NOW,
    })
    expect(result.status).toBe('cancelled')
  })

  it('já cancelada: already-cancelled, nada gravado', async () => {
    const { deps, updateSubscription } = makeDeps()

    await expect(
      new DeactivateSubscription(deps).execute(INPUT),
    ).rejects.toMatchObject({ reason: 'already-cancelled' })
    expect(updateSubscription).not.toHaveBeenCalled()
  })

  it('Stripe: gateway-managed, nada gravado', async () => {
    const { deps, updateSubscription } = makeDeps({
      sub: subscription({ status: 'active', modality: 'stripe' }),
    })

    const error = await new DeactivateSubscription(deps)
      .execute(INPUT)
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(SubscriptionActionRefusedError)
    expect((error as SubscriptionActionRefusedError).reason).toBe(
      'gateway-managed',
    )
    expect(updateSubscription).not.toHaveBeenCalled()
  })

  it('efeitos de provider desligados: recusa', async () => {
    const { deps, updateSubscription } = makeDeps({
      sub: subscription({ status: 'active' }),
      providerEffectsEnabled: false,
    })

    await expect(
      new DeactivateSubscription(deps).execute(INPUT),
    ).rejects.toBeInstanceOf(ProviderEffectsDisabledError)
    expect(updateSubscription).not.toHaveBeenCalled()
  })
})
