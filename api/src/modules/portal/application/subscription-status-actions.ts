import type { Subscription } from '@/modules/application/domain/entities/subscription'
import type { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import { SubscriptionNotFoundError } from '@/modules/application/domain/errors/subscription-not-found.error'
import {
  endOfCalendarDay,
  formatCalendarDate,
  parseSpaCalendarDate,
} from '@/modules/application/infra/bitrix/spa-calendar-date'
import { apiLogger } from '@/shared/infra/logger'
import {
  PortalAppNotFoundError,
  ProviderEffectsDisabledError,
} from '../domain/errors/portal-domain.errors'
import {
  SubscriptionActionRefusedError,
  SubscriptionNotInAppError,
  SubscriptionPeriodEndError,
} from '../domain/errors/subscription-action.errors'
import type { PortalAppReadRepository } from '../domain/repositories/portal-app-read.repository'

export type SubscriptionStatusActionDeps = {
  apps: Pick<PortalAppReadRepository, 'findById'>
  subscriptions: Pick<
    SubscriptionRepository,
    'getSubscription' | 'updateSubscription'
  >
  /**
   * `env.payments.spa.providerEffectsEnabled`. Ativar e inativar não chamam o provider,
   * mas a escrita na SPA 1142 dispara o ciclo que chama — e o portal Bitrix de
   * homologação é o de produção.
   */
  providerEffectsEnabled: boolean
  now?: () => Date
}

export type ActivateSubscriptionInput = {
  appId: string
  subscriptionId: string
  /** Novo fim de período, `YYYY-MM-DD`. Obrigatório se o período atual já terminou. */
  currentPeriodEnd?: string
}

export type SubscriptionStatusActionOutput = {
  id: string
  status: Subscription['status']
  currentPeriodEnd: string
}

/**
 * "Ativar" do backoffice: grava `Ativo` na SPA 1142 e limpa o "Vencido em".
 *
 * **Só escreve na SPA.** Assinar as linhas no provider é do ciclo da SPA 1142 — o UPDATE
 * desta escrita dispara o mesmo webhook de quando o time edita a assinatura no CRM, e
 * chamar o provider daqui também duplicaria o disparo.
 */
export class ActivateSubscription {
  constructor(private readonly deps: SubscriptionStatusActionDeps) {}

  async execute(
    input: ActivateSubscriptionInput,
  ): Promise<SubscriptionStatusActionOutput> {
    const subscription = await resolveOwnedManualSubscription(
      input.appId,
      input.subscriptionId,
      this.deps,
    )

    if (subscription.status === 'active') {
      throw new SubscriptionActionRefusedError('already-active')
    }

    const now = (this.deps.now ?? (() => new Date()))()
    const newPeriodEnd = resolveNewPeriodEnd(
      input.currentPeriodEnd,
      subscription,
      now,
    )

    const updated = await this.deps.subscriptions.updateSubscription(
      subscription.id,
      {
        status: 'active',
        pastDueAt: null,
        ...(newPeriodEnd && { currentPeriodEnd: newPeriodEnd }),
      },
    )

    apiLogger.info(
      {
        app: 'payments',
        subscriptionId: subscription.id,
        previousStatus: subscription.status,
        currentPeriodEnd: formatCalendarDate(updated.currentPeriodEnd),
      },
      'Assinatura ativada pelo backoffice',
    )

    return output(updated)
  }
}

/**
 * "Inativar" do backoffice: grava `Cancelado` e a data de cancelamento de hoje. A
 * desassinatura das linhas no provider é do ciclo da SPA 1142, como no "Ativar".
 */
export class DeactivateSubscription {
  constructor(private readonly deps: SubscriptionStatusActionDeps) {}

  async execute(input: {
    appId: string
    subscriptionId: string
  }): Promise<SubscriptionStatusActionOutput> {
    const subscription = await resolveOwnedManualSubscription(
      input.appId,
      input.subscriptionId,
      this.deps,
    )

    if (subscription.status === 'cancelled') {
      throw new SubscriptionActionRefusedError('already-cancelled')
    }

    const now = (this.deps.now ?? (() => new Date()))()

    const updated = await this.deps.subscriptions.updateSubscription(
      subscription.id,
      { status: 'cancelled', canceledAt: now },
    )

    apiLogger.info(
      {
        app: 'payments',
        subscriptionId: subscription.id,
        previousStatus: subscription.status,
      },
      'Assinatura inativada pelo backoffice',
    )

    return output(updated)
  }
}

/**
 * A assinatura da URL, desde que pertença à instalação da URL e seja manual.
 *
 * Pertencimento pelo `spaId`: a assinatura aponta para o item da SPA 1060 no campo
 * parent, e a instalação guarda o mesmo id. Instalação sem espelho não tem assinatura
 * possível, então qualquer id é "de outra instalação".
 */
async function resolveOwnedManualSubscription(
  appId: string,
  subscriptionId: string,
  deps: SubscriptionStatusActionDeps,
): Promise<Subscription> {
  const subscription = await resolveOwnedSubscription(
    appId,
    subscriptionId,
    deps,
  )

  if (subscription.modality === 'stripe') {
    throw new SubscriptionActionRefusedError('gateway-managed')
  }

  return subscription
}

/**
 * A assinatura da URL, desde que pertença à instalação da URL — de qualquer modalidade.
 * Recusa antes de qualquer leitura quando os efeitos de provider estão desligados.
 */
export async function resolveOwnedSubscription(
  appId: string,
  subscriptionId: string,
  deps: Pick<
    SubscriptionStatusActionDeps,
    'apps' | 'providerEffectsEnabled'
  > & {
    subscriptions: Pick<SubscriptionRepository, 'getSubscription'>
  },
): Promise<Subscription> {
  if (!deps.providerEffectsEnabled) throw new ProviderEffectsDisabledError()

  const app = await deps.apps.findById(appId)
  if (!app) throw new PortalAppNotFoundError()
  if (!app.spaId) throw new SubscriptionNotInAppError(subscriptionId)

  const subscription = await deps.subscriptions
    .getSubscription(subscriptionId)
    .catch((error: unknown) => {
      if (error instanceof SubscriptionNotFoundError) {
        throw new SubscriptionNotInAppError(subscriptionId)
      }
      throw error
    })

  if (subscription.aplication.spaId !== app.spaId) {
    throw new SubscriptionNotInAppError(subscriptionId)
  }

  return subscription
}

/**
 * O novo fim de período, ou `undefined` para manter o atual.
 *
 * Comparação por dia de calendário UTC, a mesma convenção do campo da SPA: "posterior a
 * hoje" é um dia depois do dia de hoje, não um instante depois de agora.
 */
function resolveNewPeriodEnd(
  raw: string | undefined,
  subscription: Subscription,
  now: Date,
): Date | undefined {
  const periodEnded = subscription.currentPeriodEnd.getTime() < now.getTime()

  if (raw === undefined || raw.trim() === '') {
    if (periodEnded) throw new SubscriptionPeriodEndError('period-end-required')
    return undefined
  }

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())
    ? parseSpaCalendarDate(raw.trim())
    : null
  if (!parsed) throw new SubscriptionPeriodEndError('period-end-invalid')

  const end = endOfCalendarDay(parsed)
  if (formatCalendarDate(end) <= formatCalendarDate(now)) {
    throw new SubscriptionPeriodEndError('period-end-invalid')
  }

  return end
}

const output = (
  subscription: Subscription,
): SubscriptionStatusActionOutput => ({
  id: subscription.id,
  status: subscription.status,
  currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
})
