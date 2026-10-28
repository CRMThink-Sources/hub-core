'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Ban,
  CircleOff,
  Info,
  Link2,
  Link2Off,
  Loader2,
  Power,
  PowerOff,
  ReceiptText,
  RotateCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { axiosPortal } from '@/infra/client/axios-portal'
import {
  isConnectorLine,
  lineActions,
  linesToUnsubscribe,
  minPeriodEnd,
  periodEnded,
  refusalMessage,
  subscribeLinesOutcome,
  subscriptionActions,
} from '@/lib/admin-subscription-actions'
import { formatSpaDate } from '@/lib/format-date'
import type {
  AppSubscription,
  AppSubscriptionItem,
  ListAppSubscriptionsResponse,
  SubscribeLinesResponse,
} from '@/lib/portal-domains'
import {
  LINE_STATUS,
  PROVIDER_BILLING_STATUS,
  STATUS_NAMESPACE,
  SUBSCRIPTION_STATUS,
  modalityLabelKey,
  statusMeta,
} from '@/lib/portal-status'
import { AdminEmptyState } from './ui/admin-empty-state'
import { AdminStatusBadge } from './ui/admin-status-badge'

/**
 * `no-mirror` é estado próprio, não lista vazia: instalação sem espelho na SPA 1060 não
 * tem o que consultar. `error` também: mostrar vazio afirmaria que o cliente não paga
 * nada.
 */
export type SectionState =
  | { kind: 'loading' }
  | {
      kind: 'ready'
      subscriptions: AppSubscription[]
      providerEffectsEnabled: boolean
    }
  | { kind: 'no-mirror' }
  | { kind: 'error' }

type PendingDialog =
  | { kind: 'activate'; subscription: AppSubscription }
  | { kind: 'deactivate'; subscription: AppSubscription }
  | {
      kind: 'unsubscribe-line'
      subscription: AppSubscription
      item: AppSubscriptionItem
    }

type Props = {
  appId: string
}

/**
 * Aba Assinaturas: as assinaturas da SPA 1142 com as linhas da 1146, e as ações do
 * suporte — ativar, inativar, assinar todas no provider e assinar/desassinar por linha.
 */
export function AdminAppSubscriptionsSection({ appId }: Props) {
  const { t } = useTranslation('admin/app-settings')
  const [state, setState] = useState<SectionState>({ kind: 'loading' })
  /** Uma ação por assinatura de cada vez: a segunda espera a primeira terminar. */
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const [dialog, setDialog] = useState<PendingDialog | null>(null)

  const load = useCallback(
    async (options: { silent?: boolean; isCancelled?: () => boolean } = {}) => {
      const isCancelled = options.isCancelled ?? (() => false)
      if (!options.silent) setState({ kind: 'loading' })
      try {
        const output = await axiosPortal().get<ListAppSubscriptionsResponse>(
          `/portal/apps/${appId}/subscriptions`,
        )
        if (isCancelled()) return
        setState(
          output.mirrored
            ? {
                kind: 'ready',
                subscriptions: output.subscriptions,
                providerEffectsEnabled: output.providerEffectsEnabled,
              }
            : { kind: 'no-mirror' },
        )
      } catch {
        if (!isCancelled()) setState({ kind: 'error' })
      }
    },
    [appId],
  )

  useEffect(() => {
    let cancelled = false
    void load({ isCancelled: () => cancelled })
    return () => {
      cancelled = true
    }
  }, [load])

  /**
   * Roda uma ação marcando a assinatura como ocupada, mostra o resultado e relê a aba.
   * A releitura é o que faz aparecer o efeito do ciclo da SPA, que roda em fila.
   */
  const run = async (
    subscriptionId: string,
    action: () => Promise<
      string | { tone: 'success' | 'warning'; message: string }
    >,
  ) => {
    if (busy.has(subscriptionId)) return
    setBusy(previous => new Set(previous).add(subscriptionId))
    try {
      const outcome = await action()
      if (typeof outcome === 'string') toast.success(outcome)
      else if (outcome.tone === 'warning') toast.warning(outcome.message)
      else toast.success(outcome.message)
    } catch (error) {
      toast.error(refusalMessage(error, t))
    } finally {
      setBusy(previous => {
        const next = new Set(previous)
        next.delete(subscriptionId)
        return next
      })
      void load({ silent: true })
    }
  }

  const base = `/portal/apps/${appId}`

  const activate = (subscription: AppSubscription, periodEnd: string) =>
    run(subscription.id, async () => {
      await axiosPortal().post(
        `${base}/subscriptions/${subscription.id}/activate`,
        periodEnd ? { currentPeriodEnd: periodEnd } : {},
      )
      return t('subscriptions.result.activated')
    })

  const deactivate = (subscription: AppSubscription) =>
    run(subscription.id, async () => {
      await axiosPortal().post(
        `${base}/subscriptions/${subscription.id}/deactivate`,
      )
      return t('subscriptions.result.deactivated')
    })

  const subscribeLines = (subscription: AppSubscription) =>
    run(subscription.id, async () => {
      const result = await axiosPortal().post<SubscribeLinesResponse>(
        `${base}/subscriptions/${subscription.id}/subscribe-lines`,
      )
      return subscribeLinesOutcome(result, t)
    })

  const lineAction = (
    subscription: AppSubscription,
    item: AppSubscriptionItem,
    action: 'subscribe' | 'unsubscribe',
  ) =>
    run(subscription.id, async () => {
      await axiosPortal().post(`${base}/thinkzap-lines/${item.id}/${action}`)
      return t(
        action === 'subscribe'
          ? 'subscriptions.result.lineSubscribed'
          : 'subscriptions.result.lineUnsubscribed',
      )
    })

  if (state.kind !== 'ready' || state.subscriptions.length === 0) {
    return <SubscriptionsStatusView state={state} onRetry={() => void load()} />
  }

  return (
    <div className="space-y-4">
      {!state.providerEffectsEnabled && (
        <p
          role="note"
          className="flex items-start gap-2 rounded-md bg-status-warning-soft px-3 py-2 text-sm text-status-warning-ink"
        >
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('subscriptions.providerEffectsDisabled')}
        </p>
      )}

      {state.subscriptions.map(subscription => (
        <SubscriptionCard
          key={subscription.id}
          subscription={subscription}
          providerEffectsEnabled={state.providerEffectsEnabled}
          busy={busy.has(subscription.id)}
          onActivate={() => setDialog({ kind: 'activate', subscription })}
          onDeactivate={() => setDialog({ kind: 'deactivate', subscription })}
          onSubscribeLines={() => void subscribeLines(subscription)}
          onLineSubscribe={item =>
            void lineAction(subscription, item, 'subscribe')
          }
          onLineUnsubscribe={item =>
            setDialog({ kind: 'unsubscribe-line', subscription, item })
          }
        />
      ))}

      <ActivateDialog
        subscription={dialog?.kind === 'activate' ? dialog.subscription : null}
        onClose={() => setDialog(null)}
        onConfirm={(subscription, periodEnd) => {
          setDialog(null)
          void activate(subscription, periodEnd)
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'deactivate'}
        title={t('subscriptions.deactivateDialog.title')}
        description={
          dialog?.kind === 'deactivate'
            ? t('subscriptions.deactivateDialog.description', {
                count: linesToUnsubscribe(dialog.subscription),
              })
            : ''
        }
        confirmLabel={t('subscriptions.deactivateDialog.confirm')}
        cancelLabel={t('subscriptions.deactivateDialog.cancel')}
        destructive
        onClose={() => setDialog(null)}
        onConfirm={() => {
          if (dialog?.kind !== 'deactivate') return
          const { subscription } = dialog
          setDialog(null)
          void deactivate(subscription)
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'unsubscribe-line'}
        title={t('subscriptions.unsubscribeDialog.title')}
        description={t('subscriptions.unsubscribeDialog.description')}
        confirmLabel={t('subscriptions.unsubscribeDialog.confirm')}
        cancelLabel={t('subscriptions.unsubscribeDialog.cancel')}
        destructive
        onClose={() => setDialog(null)}
        onConfirm={() => {
          if (dialog?.kind !== 'unsubscribe-line') return
          const { subscription, item } = dialog
          setDialog(null)
          void lineAction(subscription, item, 'unsubscribe')
        }}
      />
    </div>
  )
}

/**
 * Os estados sem lista: carregando, erro de leitura, sem espelho e sem assinatura. Cada
 * um com texto próprio — erro nunca aparece como "sem assinatura".
 */
export function SubscriptionsStatusView({
  state,
  onRetry,
}: {
  state: SectionState
  onRetry: () => void
}) {
  const { t } = useTranslation('admin/app-settings')

  switch (state.kind) {
    case 'loading':
      return (
        <div aria-busy className="space-y-3">
          <p className="sr-only">{t('subscriptions.loading')}</p>
          {[0, 1].map(index => (
            <div
              key={index}
              className="h-40 rounded-lg border border-border bg-card"
            />
          ))}
        </div>
      )
    case 'error':
      return (
        <AdminEmptyState
          icon={AlertTriangle}
          title={t('subscriptions.errorTitle')}
          description={t('subscriptions.errorDescription')}
          action={
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCw className="size-3.5" />
              {t('subscriptions.retry')}
            </Button>
          }
        />
      )
    case 'no-mirror':
      return (
        <AdminEmptyState
          icon={Link2Off}
          title={t('subscriptions.noMirrorTitle')}
          description={t('subscriptions.noMirrorDescription')}
        />
      )
    case 'ready':
      return state.subscriptions.length === 0 ? (
        <AdminEmptyState
          icon={ReceiptText}
          title={t('subscriptions.emptyTitle')}
          description={t('subscriptions.emptyDescription')}
        />
      ) : null
  }
}

type SubscriptionCardProps = {
  subscription: AppSubscription
  providerEffectsEnabled: boolean
  busy: boolean
  onActivate: () => void
  onDeactivate: () => void
  onSubscribeLines: () => void
  onLineSubscribe: (item: AppSubscriptionItem) => void
  onLineUnsubscribe: (item: AppSubscriptionItem) => void
}

/** Uma assinatura: cabeçalho com status e ações, dados do contrato e as linhas. */
export function SubscriptionCard({
  subscription,
  providerEffectsEnabled,
  busy,
  onActivate,
  onDeactivate,
  onSubscribeLines,
  onLineSubscribe,
  onLineUnsubscribe,
}: SubscriptionCardProps) {
  const { t, i18n } = useTranslation('admin/app-settings')
  const { t: tStatus } = useTranslation(STATUS_NAMESPACE)
  const status = statusMeta(SUBSCRIPTION_STATUS, subscription.status)
  const actions = subscriptionActions(subscription, providerEffectsEnabled)
  const locale = i18n.language
  const disabledTitle = actions.disabledReason
    ? t('subscriptions.providerEffectsDisabled')
    : undefined

  return (
    <article
      aria-busy={busy}
      className="rounded-lg border border-border bg-card"
    >
      <header className="flex flex-col gap-3 px-5 pt-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-medium text-foreground">
              {subscription.name}
            </h3>
            <AdminStatusBadge tone={status.tone}>
              {tStatus(status.labelKey)}
            </AdminStatusBadge>
          </div>
          {!actions.manageable && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('subscriptions.stripeManaged')}
            </p>
          )}
        </div>

        <div
          role="group"
          aria-label={t('subscriptions.actions.menu')}
          className="flex shrink-0 flex-wrap gap-2"
        >
          {actions.manageable && subscription.status !== 'active' && (
            <Button
              size="sm"
              disabled={busy || !actions.canActivate}
              title={disabledTitle}
              onClick={onActivate}
            >
              <Power className="size-3.5" />
              {t('subscriptions.actions.activate')}
            </Button>
          )}
          {actions.manageable && subscription.status !== 'cancelled' && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !actions.canDeactivate}
              title={disabledTitle}
              onClick={onDeactivate}
            >
              <PowerOff className="size-3.5" />
              {t('subscriptions.actions.deactivate')}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !actions.canSubscribeLines}
            title={disabledTitle}
            onClick={onSubscribeLines}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Link2 className="size-3.5" />
            )}
            {t('subscriptions.actions.subscribeLines')}
          </Button>
        </div>
      </header>

      <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t('subscriptions.modality')}>
          {tStatus(modalityLabelKey(subscription.modality))}
        </Field>
        <Field label={t('subscriptions.plan')}>
          {subscription.planName}
          <span className="block text-xs text-muted-foreground">
            {subscription.productName}
          </span>
        </Field>
        <Field label={t('subscriptions.period')}>
          <span className="tabular-nums">
            {t('subscriptions.periodValue', {
              start: formatSpaDate(subscription.currentPeriodStart, locale),
              end: formatSpaDate(subscription.currentPeriodEnd, locale),
            })}
          </span>
        </Field>
        <Field label={t('subscriptions.gatewayId')}>
          <span className="font-mono text-xs break-all">
            {subscription.gatewayId ?? '—'}
          </span>
        </Field>
      </dl>

      <section className="border-t border-border px-5 py-4">
        <h4 className="text-xs font-medium text-muted-foreground">
          {t('subscriptions.linesTitle')}
        </h4>
        {subscription.items.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t('subscriptions.linesEmpty')}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {subscription.items.map(item => (
              <SubscriptionLineRow
                key={item.id}
                item={item}
                providerEffectsEnabled={providerEffectsEnabled}
                busy={busy}
                onSubscribe={() => onLineSubscribe(item)}
                onUnsubscribe={() => onLineUnsubscribe(item)}
              />
            ))}
          </ul>
        )}
      </section>
    </article>
  )
}

export function SubscriptionLineRow({
  item,
  providerEffectsEnabled,
  busy,
  onSubscribe,
  onUnsubscribe,
}: {
  item: AppSubscriptionItem
  providerEffectsEnabled: boolean
  busy: boolean
  onSubscribe: () => void
  onUnsubscribe: () => void
}) {
  const { t } = useTranslation('admin/app-settings')
  const { t: tStatus } = useTranslation(STATUS_NAMESPACE)
  const lineStatus = statusMeta(LINE_STATUS, item.status)
  const billing = statusMeta(PROVIDER_BILLING_STATUS, item.providerBilling)
  const connector = isConnectorLine(item)
  const state = lineActions(item, providerEffectsEnabled)
  const reason =
    state.disabledReason === 'no-credential'
      ? t('subscriptions.noCredential')
      : state.disabledReason === 'provider-effects-disabled'
        ? t('subscriptions.providerEffectsDisabled')
        : undefined

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {item.name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {connector ? item.metadata.provider : t('subscriptions.noProvider')}
          </span>
          <AdminStatusBadge tone={lineStatus.tone} className="h-5 px-2">
            {tStatus(lineStatus.labelKey)}
          </AdminStatusBadge>
          {connector && (
            <AdminStatusBadge tone={billing.tone} className="h-5 px-2">
              {tStatus(billing.labelKey)}
            </AdminStatusBadge>
          )}
        </div>
        {connector && state.disabledReason === 'no-credential' && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <CircleOff aria-hidden className="size-3" />
            {reason}
          </p>
        )}
      </div>

      {connector && (
        <div className="flex shrink-0 gap-2">
          <Button
            size="xs"
            variant="outline"
            disabled={busy || !state.enabled}
            title={reason}
            onClick={onSubscribe}
          >
            <Link2 className="size-3" />
            {t('subscriptions.actions.lineSubscribe')}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={busy || !state.enabled}
            title={reason}
            onClick={onUnsubscribe}
          >
            <Ban className="size-3" />
            {t('subscriptions.actions.lineUnsubscribe')}
          </Button>
        </div>
      )}
    </li>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  )
}

/**
 * "Ativar" pede o novo fim do período quando o atual já terminou — sem ele a api
 * recusa, porque a verificação marcaria `Vencido` de novo na rodada seguinte.
 */
function ActivateDialog({
  subscription,
  onClose,
  onConfirm,
}: {
  subscription: AppSubscription | null
  onClose: () => void
  onConfirm: (subscription: AppSubscription, periodEnd: string) => void
}) {
  const { t, i18n } = useTranslation('admin/app-settings')
  const [periodEnd, setPeriodEnd] = useState('')
  const now = new Date()
  const ended = subscription ? periodEnded(subscription, now) : false
  const currentEnd = subscription
    ? formatSpaDate(subscription.currentPeriodEnd, i18n.language)
    : ''
  const min = minPeriodEnd(now)
  const invalid =
    (ended && periodEnd === '') || (periodEnd !== '' && periodEnd < min)

  return (
    <Dialog
      open={subscription !== null}
      onOpenChange={open => {
        if (!open) {
          setPeriodEnd('')
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('subscriptions.activateDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('subscriptions.activateDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="activate-period-end">
            {t('subscriptions.activateDialog.periodEnd')}
          </FieldLabel>
          <Input
            id="activate-period-end"
            type="date"
            min={min}
            required={ended}
            value={periodEnd}
            onChange={event => setPeriodEnd(event.target.value)}
            aria-describedby="activate-period-end-hint"
          />
          <p
            id="activate-period-end-hint"
            className="text-xs text-muted-foreground"
          >
            {ended
              ? t('subscriptions.activateDialog.periodEndRequired', {
                  date: currentEnd,
                })
              : t('subscriptions.activateDialog.periodEndOptional', {
                  date: currentEnd,
                })}
          </p>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setPeriodEnd('')
              onClose()
            }}
          >
            {t('subscriptions.activateDialog.cancel')}
          </Button>
          <Button
            disabled={invalid}
            onClick={() => {
              if (!subscription) return
              const value = periodEnd
              setPeriodEnd('')
              onConfirm(subscription, value)
            }}
          >
            {t('subscriptions.activateDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  destructive?: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
