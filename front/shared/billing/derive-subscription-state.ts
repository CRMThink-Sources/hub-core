/**
 * Traduz as assinaturas de `GET /api/application/me` (modelo da SPA) para o
 * shape que a UI já consumia de `session.subscription` (modelo Prisma antigo).
 *
 * Existe porque os dois modelos convivem: a SPA é a fonte de verdade do
 * contrato, mas `connectorQuantity` e `trialEndsAt` são vocabulário do modelo
 * antigo, que não vale perpetuar no contrato novo. Isolar a tradução aqui deixa
 * um arquivo com teste para apagar quando o modelo antigo morrer, em vez de
 * espalhar a regra por cinco componentes.
 *
 * Ver spec `aplication-context-provider`.
 */

/** Status como a SPA emite (`aplication-context-query`). */
export type SpaSubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'trialing'
  | 'trial_expired'

/** Status como a UI já escreve nas comparações que existem hoje. */
export type UiSubscriptionStatus =
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'TRIALING'
  | 'TRIAL_EXPIRED'

export type SubscriptionItemStatus = 'active' | 'cancelled'

/**
 * Mínimo estrutural que a derivação precisa. O payload completo de
 * `/api/application/me` vive em `shared/aplication/aplication-context.ts` e é
 * assinável a este tipo — este módulo não deve crescer junto com o contrato.
 */
export type AplicationSubscriptionView = {
  id: string
  status: SpaSubscriptionStatus
  currentPeriodEnd: string
  items: ReadonlyArray<{ status: SubscriptionItemStatus }>
}

export type SubscriptionState = {
  hasSubscription: boolean
  status: UiSubscriptionStatus | null
  /** Linhas contratadas = itens ativos das assinaturas que não estão mortas. */
  connectorQuantity: number
  /** ISO 8601, só quando a assinatura de referência está em trial. */
  trialEndsAt: string | null
}

export const EMPTY_SUBSCRIPTION_STATE: SubscriptionState = {
  hasSubscription: false,
  status: null,
  connectorQuantity: 0,
  trialEndsAt: null,
}

const UI_STATUS: Record<SpaSubscriptionStatus, UiSubscriptionStatus> = {
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  cancelled: 'CANCELLED',
  trialing: 'TRIALING',
  trial_expired: 'TRIAL_EXPIRED',
}

/**
 * Status que não descrevem mais o que a instalação tem.
 *
 * Conjunto nomeado, e não duas comparações com `'cancelled'` espalhadas: contar as
 * linhas de um teste encerrado como contratadas é o mesmo erro que contar as de uma
 * cancelada, e um status morto novo tem que entrar num lugar só.
 */
const DEAD_STATUSES: ReadonlySet<SpaSubscriptionStatus> = new Set([
  'cancelled',
  'trial_expired',
])

const isLive = (s: AplicationSubscriptionView): boolean =>
  !DEAD_STATUSES.has(s.status)

const periodEndMs = (s: AplicationSubscriptionView): number => {
  const ms = new Date(s.currentPeriodEnd).getTime()
  // Data inválida não pode ganhar a comparação nem quebrar a ordenação.
  return Number.isNaN(ms) ? -Infinity : ms
}

/**
 * Assinatura de referência: entre as que não estão em status morto, a de maior
 * `currentPeriodEnd`; se todas estiverem mortas, a de maior `currentPeriodEnd`.
 *
 * Empate resolve pela primeira da lista — a ordem da resposta é estável, então o
 * resultado não oscila entre renders.
 */
export function referenceSubscription(
  subscriptions: readonly AplicationSubscriptionView[],
): AplicationSubscriptionView | null {
  const live = subscriptions.filter(isLive)
  const pool = live.length > 0 ? live : subscriptions

  return pool.reduce<AplicationSubscriptionView | null>(
    (best, current) =>
      best === null || periodEndMs(current) > periodEndMs(best)
        ? current
        : best,
    null,
  )
}

export function deriveSubscriptionState(
  subscriptions: readonly AplicationSubscriptionView[] | undefined | null,
): SubscriptionState {
  if (!subscriptions || subscriptions.length === 0) {
    return EMPTY_SUBSCRIPTION_STATE
  }

  const reference = referenceSubscription(subscriptions)

  const connectorQuantity = subscriptions
    .filter(isLive)
    .reduce(
      (total, s) => total + s.items.filter(i => i.status === 'active').length,
      0,
    )

  return {
    hasSubscription: true,
    status: reference ? UI_STATUS[reference.status] : null,
    connectorQuantity,
    trialEndsAt:
      reference?.status === 'trialing' ? reference.currentPeriodEnd : null,
  }
}

/** Alinhado ao backend: só ACTIVE e PAST_DUE permitem aumentar linhas. */
export const podeAlterarAssinaturaExistente = (
  status: UiSubscriptionStatus | null | undefined,
): boolean => status === 'ACTIVE' || status === 'PAST_DUE'
