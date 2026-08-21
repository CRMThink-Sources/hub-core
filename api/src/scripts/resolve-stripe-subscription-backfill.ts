import { Subscription } from '@/modules/application/domain/entities/subscription'

/**
 * As decisões puras do backfill de cobrança **a partir do gateway**, sem I/O.
 *
 * Irmão de `resolve-legacy-subscription-backfill`, que lia `billing_subscriptions`.
 * Aquela tabela foi dropada pela migration `20260803120000_drop_billing_subscriptions_and_plans`
 * antes do espelhamento acontecer, então o vínculo instalação↔assinatura passou a
 * existir só na API do Stripe: `metadata.clientId` de cada assinatura é o id do item
 * da instalação na SPA 1060 — a mesma coisa que `core_apps.spa_id`.
 *
 * O que **não** está aqui, e é reaproveitado de `resolve-legacy-subscription-backfill`:
 * derivação de provider da instância, escolha de plano, pareamento com itens
 * existentes e nome da linha. Aquelas regras não dependem da fonte do dado.
 */

/**
 * Assinatura do gateway reduzida ao que o backfill precisa.
 *
 * Declarada estruturalmente em vez de importar `Stripe.Subscription`: mantém este
 * módulo testável sem o SDK e alinhado com `read-subscription-period`, que usa o
 * mesmo recurso pelo mesmo motivo.
 */
export type StripeSubscriptionLike = {
  id: string
  status: string
  metadata?: Record<string, string> | null
  trial_end?: number | null
  created?: number | null
  items?: { data?: Array<{ quantity?: number | null }> }
}

/** A assinatura do gateway já normalizada para o vocabulário do backfill. */
export type StripeSubscriptionRow = {
  id: string
  /** Status cru do gateway, em minúsculas. A tradução é `mapStripeStatus`. */
  status: string
  /** Id do item da instalação na SPA 1060, de `metadata.clientId`. */
  clientId: string | null
  /** Quantidade contratada, para o relatório de divergência. */
  quantity: number
  trialEnd: Date | null
  createdAt: Date | null
}

/**
 * Status do gateway → status da SPA, **mapa explícito**, pelas mesmas razões do
 * backfill legado: `past_due` não pode escorregar para `active` por transformação de
 * texto, e `trialing` não colapsa em `active` porque trial é janela e o produto
 * bloqueia a linha quando ela vence.
 *
 * Fora do mapa é `null`, e quem chama conta como pulada — inclui `canceled`,
 * `incomplete`, `unpaid` e `paused`, que não descrevem cobrança viva.
 */
const STATUS_BY_STRIPE_STATUS: Record<string, Subscription['status']> = {
  active: 'active',
  trialing: 'trialing',
}

export function mapStripeStatus(raw: string): Subscription['status'] | null {
  return STATUS_BY_STRIPE_STATUS[raw] ?? null
}

/**
 * `metadata.clientId` é o único vínculo que sobrou com a instalação. Vazio ou só
 * espaço conta como ausente: `crm.item.get` com id vazio devolveria erro longe
 * daqui, e o relatório precisa nomear a assinatura órfã.
 */
export function readClientId(
  subscription: StripeSubscriptionLike,
): string | null {
  const raw = subscription.metadata?.clientId
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  return trimmed === '' ? null : trimmed
}

export function toStripeSubscriptionRow(
  subscription: StripeSubscriptionLike,
): StripeSubscriptionRow {
  return {
    id: subscription.id,
    status: subscription.status,
    clientId: readClientId(subscription),
    /**
     * A quantidade vive no item de linha, não na assinatura. Ausente vira `0`, que
     * o relatório de divergência trata como "contrato sem quantidade declarada".
     */
    quantity: Number(subscription.items?.data?.[0]?.quantity ?? 0),
    trialEnd: subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null,
    createdAt: subscription.created
      ? new Date(subscription.created * 1000)
      : null,
  }
}

/** Assinatura que o backfill não pode espelhar, e o motivo, para o relatório. */
export type StripeSubscriptionProblem =
  | { kind: 'status'; row: StripeSubscriptionRow }
  | { kind: 'without-client-id'; row: StripeSubscriptionRow }

export type StripeSubscriptionTriage = {
  eligible: Array<{
    row: StripeSubscriptionRow
    status: Subscription['status']
  }>
  problems: StripeSubscriptionProblem[]
}

/**
 * Separa o que dá para espelhar do que precisa de mão humana, **antes** de qualquer
 * escrita.
 *
 * Ordena por data de criação como o backfill legado fazia (`ORDER BY created_at`):
 * assinatura mais antiga primeiro deixa o output comparável entre o dry-run e o
 * `--apply`, e é a ordem em que um operador espera ver o histórico.
 */
export function triageSubscriptions(
  rows: StripeSubscriptionRow[],
): StripeSubscriptionTriage {
  const triage: StripeSubscriptionTriage = { eligible: [], problems: [] }

  const ordered = [...rows].sort(
    (left, right) =>
      (left.createdAt?.getTime() ?? 0) - (right.createdAt?.getTime() ?? 0),
  )

  for (const row of ordered) {
    const status = mapStripeStatus(row.status)

    if (!status) {
      triage.problems.push({ kind: 'status', row })
      continue
    }

    if (!row.clientId) {
      triage.problems.push({ kind: 'without-client-id', row })
      continue
    }

    triage.eligible.push({ row, status })
  }

  return triage
}
